<?php

declare(strict_types=1);

namespace YahooCrm\Controllers;

use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Guard;
use YahooCrm\Password;
use YahooCrm\Request;
use YahooCrm\Response;
use Throwable;

final class CompanyAdminController
{
    public function __construct(private readonly Database $db)
    {
    }

    public function index(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $admins = $this->db->find(Collections::USERS, ['role' => 'admin'], [
            'projection' => ['password_hash' => 0],
            'sort' => ['created_at' => -1],
        ]);
        $admins = $this->db->populate($admins, 'company_id', Collections::COMPANIES, ['name', 'code', 'is_active']);
        $ids = [];
        foreach ($admins as $admin) {
            $id = Doc::oid($admin['company_id'] ?? null);
            if ($id !== null) {
                $ids[(string) $id] = $id;
            }
        }
        $counts = $ids === [] ? [] : $this->db->aggregate(Collections::USERS, [
            ['$match' => ['company_id' => ['$in' => array_values($ids)], 'role' => 'employee']],
            ['$group' => ['_id' => '$company_id', 'count' => ['$sum' => 1]]],
        ]);
        $map = [];
        foreach ($counts as $item) {
            $map[(string) $item['_id']] = (int) $item['count'];
        }

        return Response::json([
            'success' => true,
            'admins' => array_map(function (array $admin) use ($map): array {
                $companyId = Doc::idString($admin['company_id'] ?? null);
                $company = is_array($admin['company_id'] ?? null) ? $admin['company_id'] : [];
                return array_merge($this->format($admin), [
                    'employees' => $companyId !== null ? ($map[$companyId] ?? 0) : 0,
                    'company_active' => ($company['is_active'] ?? true) !== false,
                ]);
            }, $admins),
        ]);
    }

    public function show(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $admin = $this->findAdmin($request->params['id'] ?? null);
        if ($admin instanceof Response) {
            return $admin;
        }
        $companyId = Doc::oid($admin['company_id'] ?? null);
        $employees = $companyId ? $this->db->count(Collections::USERS, ['company_id' => $companyId, 'role' => 'employee']) : 0;
        $company = is_array($admin['company_id'] ?? null) ? $admin['company_id'] : [];
        return Response::json([
            'success' => true,
            'admin' => array_merge($this->format($admin), [
                'employees' => $employees,
                'company_active' => ($company['is_active'] ?? true) !== false,
            ]),
        ]);
    }

    public function assignCompany(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $admin = $this->findAdmin($request->params['id'] ?? null, false);
        if ($admin instanceof Response) {
            return $admin;
        }
        $companyId = Doc::oid($request->body['company_id'] ?? null);
        if ($companyId === null) {
            return Response::json(['success' => false, 'error' => 'Select a valid company.'], 400);
        }
        $company = $this->db->findOne(Collections::COMPANIES, ['_id' => $companyId]);
        if ($company === null) {
            return Response::json(['success' => false, 'error' => 'Company not found.'], 404);
        }
        if (($company['is_active'] ?? true) === false) {
            return Response::json(['success' => false, 'error' => 'Cannot assign an admin to an inactive company.'], 400);
        }
        if ($this->db->exists(Collections::USERS, [
            'company_id' => $company['_id'],
            'role' => 'admin',
            '_id' => ['$ne' => $admin['_id']],
        ])) {
            return Response::json(['success' => false, 'error' => 'This company already has another Company Admin.'], 409);
        }
        $this->db->updateOne(Collections::USERS, ['_id' => $admin['_id']], ['company_id' => $company['_id']]);
        $this->db->updateOne(Collections::COMPANIES, ['_id' => $company['_id']], [
            'admin_name' => $admin['full_name'] ?? '',
            'admin_email' => $admin['email'] ?? '',
        ]);
        return Response::json([
            'success' => true,
            'message' => 'Company assigned successfully.',
            'admin' => [
                'id' => (string) $admin['_id'],
                'full_name' => $admin['full_name'] ?? '',
                'email' => $admin['email'] ?? '',
                'company_id' => (string) $company['_id'],
                'company_name' => $company['name'] ?? '',
                'company_code' => $company['code'] ?? '',
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $name = is_string($request->body['full_name'] ?? null) ? trim($request->body['full_name']) : '';
        $email = is_string($request->body['email'] ?? null) ? strtolower(trim($request->body['email'])) : '';
        $phone = is_string($request->body['phone'] ?? null) ? trim($request->body['phone']) : '';
        $password = $request->body['password'] ?? null;
        $companyId = Doc::oid($request->body['company_id'] ?? null);

        if ($name === '' || $email === '' || !is_string($password) || $password === '' || $companyId === null) {
            return Response::json(['success' => false, 'error' => 'Name, email, password and company are required.'], 400);
        }
        if (!Guard::email($email)) {
            return Response::json(['success' => false, 'error' => 'Enter a valid email address.'], 400);
        }
        if (strlen($password) < 8) {
            return Response::json(['success' => false, 'error' => 'Password must contain at least 8 characters.'], 400);
        }
        $company = $this->db->findOne(Collections::COMPANIES, ['_id' => $companyId]);
        if ($company === null) {
            return Response::json(['success' => false, 'error' => 'Company not found.'], 404);
        }
        if (($company['is_active'] ?? true) === false) {
            return Response::json(['success' => false, 'error' => 'Cannot assign an admin to an inactive company.'], 400);
        }
        if ($this->db->exists(Collections::USERS, ['company_id' => $company['_id'], 'role' => 'admin'])) {
            return Response::json(['success' => false, 'error' => 'This company already has a Company Admin account.'], 409);
        }
        if ($this->db->exists(Collections::USERS, ['email' => $email])) {
            return Response::json(['success' => false, 'error' => 'An account with this email already exists.'], 409);
        }

        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code = 'ADM-' . strtoupper(bin2hex(random_bytes(4)));
            if (!$this->db->exists(Collections::USERS, ['employee_code' => $code])) {
                break;
            }
        }

        $createdId = null;
        try {
            $admin = $this->db->insert(Collections::USERS, [
                'employee_code' => $code,
                'full_name' => $name,
                'email' => $email,
                'phone' => $phone,
                'password_hash' => Password::hash($password),
                'role' => 'admin',
                'company_id' => $company['_id'],
                'is_active' => true,
                'is_assignment_eligible' => false,
                'timezone' => 'Asia/Kolkata',
                'team_id' => null,
                'last_login_at' => null,
            ]);
            $createdId = $admin['_id'];
            $this->db->updateOne(Collections::COMPANIES, ['_id' => $company['_id']], [
                'admin_name' => $name,
                'admin_email' => $email,
            ]);
        } catch (Throwable $error) {
            if ($createdId !== null) {
                $this->db->deleteOne(Collections::USERS, ['_id' => $createdId]);
            }
            if (Doc::duplicate($error)) {
                return Response::json(['success' => false, 'error' => 'The email or employee code already exists.'], 409);
            }
            throw $error;
        }

        return Response::json([
            'success' => true,
            'message' => 'Company Admin created successfully.',
            'admin' => [
                'id' => (string) $admin['_id'],
                'employee_code' => $admin['employee_code'],
                'full_name' => $admin['full_name'],
                'email' => $admin['email'],
                'phone' => $admin['phone'] ?? '',
                'role' => 'admin',
                'company_id' => (string) $company['_id'],
                'company_name' => $company['name'] ?? '',
                'company_code' => $company['code'] ?? '',
                'is_active' => true,
                'employees' => 0,
                'created_at' => Doc::iso($admin['created_at'] ?? null),
            ],
        ], 201);
    }

    public function status(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $active = $request->body['is_active'] ?? null;
        if (!is_bool($active)) {
            return Response::json(['success' => false, 'error' => 'is_active must be true or false.'], 400);
        }
        $admin = $this->findAdmin($request->params['id'] ?? null, false);
        if ($admin instanceof Response) {
            return $admin;
        }
        if ($active) {
            $company = Doc::oid($admin['company_id'] ?? null)
                ? $this->db->findOne(Collections::COMPANIES, ['_id' => Doc::oid($admin['company_id'])], ['projection' => ['is_active' => 1]])
                : null;
            if ($company === null || ($company['is_active'] ?? true) === false) {
                return Response::json(['success' => false, 'error' => 'Assign an active company before activating this admin.'], 400);
            }
        }
        $this->db->updateOne(Collections::USERS, ['_id' => $admin['_id']], ['is_active' => $active]);
        return Response::json([
            'success' => true,
            'message' => 'Company Admin ' . ($active ? 'activated' : 'deactivated') . ' successfully.',
            'admin' => ['id' => (string) $admin['_id'], 'is_active' => $active],
        ]);
    }

    private function findAdmin(mixed $id, bool $populate = true): array|Response
    {
        $oid = Doc::oid($id);
        if ($oid === null) {
            return Response::json(['success' => false, 'error' => 'Invalid Company Admin ID.'], 400);
        }
        $admin = $this->db->findOne(Collections::USERS, ['_id' => $oid, 'role' => 'admin'], ['projection' => ['password_hash' => 0]]);
        if ($admin === null) {
            return Response::json(['success' => false, 'error' => 'Company Admin not found.'], 404);
        }
        return $populate
            ? $this->db->populateOne($admin, 'company_id', Collections::COMPANIES, ['name', 'code', 'is_active'])
            : $admin;
    }

    private function format(array $user): array
    {
        $company = is_array($user['company_id'] ?? null) ? $user['company_id'] : null;
        return [
            'id' => (string) $user['_id'],
            'employee_code' => $user['employee_code'] ?? '',
            'full_name' => $user['full_name'] ?? '',
            'email' => $user['email'] ?? '',
            'phone' => $user['phone'] ?? '',
            'role' => $user['role'] ?? 'admin',
            'company_id' => $company ? (string) $company['_id'] : Doc::idString($user['company_id'] ?? null),
            'company_name' => $company['name'] ?? '',
            'company_code' => $company['code'] ?? '',
            'is_active' => (bool) ($user['is_active'] ?? false),
            'created_at' => Doc::iso($user['created_at'] ?? null),
        ];
    }
}
