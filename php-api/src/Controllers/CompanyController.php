<?php

declare(strict_types=1);

namespace YahooCrm\Controllers;

use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Guard;
use YahooCrm\HttpException;
use YahooCrm\Request;
use YahooCrm\Response;
use Throwable;

final class CompanyController
{
    public function __construct(private readonly Database $db)
    {
    }

    public function index(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $companies = $this->db->find(Collections::COMPANIES, [], ['sort' => ['created_at' => -1]]);
        $ids = array_map(static fn (array $company) => $company['_id'], $companies);
        $counts = $ids === [] ? [] : $this->db->aggregate(Collections::USERS, [
            ['$match' => ['company_id' => ['$in' => $ids], 'role' => 'employee']],
            ['$group' => ['_id' => '$company_id', 'count' => ['$sum' => 1]]],
        ]);
        $map = [];
        foreach ($counts as $item) {
            $map[(string) $item['_id']] = (int) $item['count'];
        }

        return Response::json([
            'success' => true,
            'data' => [
                'companies' => array_map(function (array $company) use ($map): array {
                    $active = ($company['is_active'] ?? true) !== false;
                    return [
                        'id' => (string) $company['_id'],
                        'name' => $company['name'] ?? '',
                        'code' => $company['code'] ?? '',
                        'admin_name' => $company['admin_name'] ?? '',
                        'admin_email' => $company['admin_email'] ?? '',
                        'phone' => $company['phone'] ?? '',
                        'employees' => $map[(string) $company['_id']] ?? 0,
                        'leads' => 0,
                        'is_active' => $active,
                        'status' => $active ? 'Active' : 'Inactive',
                        'created_at' => Doc::iso($company['created_at'] ?? null),
                    ];
                }, $companies),
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $name = is_string($request->body['name'] ?? null) ? trim($request->body['name']) : '';
        $adminName = is_string($request->body['admin_name'] ?? null) ? trim($request->body['admin_name']) : '';
        $adminEmail = is_string($request->body['admin_email'] ?? null) ? strtolower(trim($request->body['admin_email'])) : '';
        $phone = is_string($request->body['phone'] ?? null) ? trim($request->body['phone']) : '';

        if ($name === '' || $adminName === '' || !Guard::email($adminEmail)) {
            return Response::json([
                'success' => false,
                'error' => 'Enter a company name, admin name, and valid admin email.',
            ], 400);
        }

        try {
            $company = $this->db->insert(Collections::COMPANIES, [
                'name' => $name,
                'admin_name' => $adminName,
                'admin_email' => $adminEmail,
                'phone' => $phone !== '' ? $phone : null,
                'code' => 'YCR-' . strtoupper(substr((string) new \MongoDB\BSON\ObjectId(), -6)),
                'is_active' => true,
            ]);
        } catch (Throwable $error) {
            if (Doc::duplicate($error)) {
                return Response::json(['success' => false, 'error' => 'A company with this unique value already exists.'], 409);
            }
            throw $error;
        }

        return Response::json([
            'success' => true,
            'data' => [
                'company' => [
                    'id' => (string) $company['_id'],
                    'name' => $company['name'],
                    'code' => $company['code'],
                    'admin_name' => $company['admin_name'],
                    'admin_email' => $company['admin_email'],
                    'phone' => $company['phone'] ?? '',
                    'employees' => 0,
                    'leads' => 0,
                    'status' => 'Active',
                    'is_active' => true,
                    'created_at' => Doc::iso($company['created_at'] ?? null),
                ],
            ],
        ], 201);
    }

    public function update(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $id = Doc::oid($request->params['id'] ?? null);
        if ($id === null) {
            return Response::json(['success' => false, 'error' => 'Invalid company ID.'], 400);
        }
        $company = $this->db->findOne(Collections::COMPANIES, ['_id' => $id]);
        if ($company === null) {
            return Response::json(['success' => false, 'error' => 'Company not found.'], 404);
        }

        $updates = [];
        $body = $request->body;
        if (array_key_exists('name', $body)) {
            if (!is_string($body['name']) || trim($body['name']) === '') {
                return Response::json(['success' => false, 'error' => 'Company name is required.'], 400);
            }
            $updates['name'] = trim($body['name']);
        }
        if (array_key_exists('admin_name', $body)) {
            if (!is_string($body['admin_name']) || trim($body['admin_name']) === '') {
                return Response::json(['success' => false, 'error' => 'Admin name is required.'], 400);
            }
            $updates['admin_name'] = trim($body['admin_name']);
        }
        if (array_key_exists('admin_email', $body)) {
            $email = is_string($body['admin_email']) ? strtolower(trim($body['admin_email'])) : '';
            if (!Guard::email($email)) {
                return Response::json(['success' => false, 'error' => 'Enter a valid admin email.'], 400);
            }
            $updates['admin_email'] = $email;
        }
        if (array_key_exists('phone', $body)) {
            if (!is_string($body['phone'])) {
                return Response::json(['success' => false, 'error' => 'Phone must be text.'], 400);
            }
            $updates['phone'] = trim($body['phone']) !== '' ? trim($body['phone']) : null;
        }

        $admin = $this->db->findOne(Collections::USERS, ['company_id' => $company['_id'], 'role' => 'admin']);
        if (isset($updates['admin_email'])) {
            $filter = ['email' => $updates['admin_email']];
            if ($admin !== null) {
                $filter['_id'] = ['$ne' => $admin['_id']];
            }
            if ($this->db->exists(Collections::USERS, $filter)) {
                return Response::json(['success' => false, 'error' => 'This email is already used by another user account.'], 409);
            }
        }

        try {
            if ($admin !== null) {
                $adminUpdates = [];
                if (isset($updates['admin_name'])) {
                    $adminUpdates['full_name'] = $updates['admin_name'];
                }
                if (isset($updates['admin_email'])) {
                    $adminUpdates['email'] = $updates['admin_email'];
                }
                if ($adminUpdates !== []) {
                    $this->db->updateOne(Collections::USERS, ['_id' => $admin['_id']], $adminUpdates);
                }
            }
            if ($updates !== []) {
                $this->db->updateOne(Collections::COMPANIES, ['_id' => $company['_id']], $updates);
                $company = array_merge($company, $updates);
            }
        } catch (Throwable $error) {
            if (Doc::duplicate($error)) {
                return Response::json(['success' => false, 'error' => 'This email or unique value is already in use.'], 409);
            }
            throw $error;
        }

        $active = ($company['is_active'] ?? true) !== false;
        return Response::json([
            'success' => true,
            'message' => 'Company details updated successfully.',
            'data' => [
                'company' => [
                    'id' => (string) $company['_id'],
                    'name' => $company['name'] ?? '',
                    'code' => $company['code'] ?? '',
                    'admin_name' => $company['admin_name'] ?? '',
                    'admin_email' => $company['admin_email'] ?? '',
                    'phone' => $company['phone'] ?? '',
                    'is_active' => $active,
                    'status' => $active ? 'Active' : 'Inactive',
                ],
                'admin_account_updated' => $admin !== null,
            ],
        ]);
    }

    public function status(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $id = Doc::oid($request->params['id'] ?? null);
        $active = $request->body['is_active'] ?? null;
        if ($id === null) {
            return Response::json(['success' => false, 'error' => 'Invalid company ID.'], 400);
        }
        if (!is_bool($active)) {
            return Response::json(['success' => false, 'error' => 'is_active must be true or false.'], 400);
        }
        $company = $this->db->replaceFields(Collections::COMPANIES, ['_id' => $id], ['is_active' => $active]);
        if ($company === null) {
            return Response::json(['success' => false, 'error' => 'Company not found.'], 404);
        }
        return Response::json([
            'success' => true,
            'data' => [
                'id' => (string) $company['_id'],
                'name' => $company['name'] ?? '',
                'is_active' => (bool) $company['is_active'],
                'status' => $company['is_active'] ? 'Active' : 'Inactive',
            ],
        ]);
    }
}
