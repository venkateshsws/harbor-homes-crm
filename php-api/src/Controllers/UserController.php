<?php

declare(strict_types=1);

namespace YahooCrm\Controllers;

use YahooCrm\Catalog;
use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Guard;
use YahooCrm\Password;
use YahooCrm\Request;
use YahooCrm\Response;
use YahooCrm\Scope;
use Throwable;

final class UserController
{
    public function __construct(private readonly Database $db)
    {
    }

    public function index(Request $request): Response
    {
        $current = Guard::user($request);
        $role = $current['role'] ?? '';
        $filter = [];

        if ($role === 'super_admin') {
            $companyId = $request->query['company_id'] ?? null;
            if (is_string($companyId) && $companyId !== '') {
                $oid = Doc::oid($companyId);
                if ($oid === null) {
                    return Response::json(['success' => false, 'error' => 'Invalid company ID.'], 400);
                }
                if (!$this->db->exists(Collections::COMPANIES, ['_id' => $oid])) {
                    return Response::json(['success' => false, 'error' => 'Company not found.'], 404);
                }
                $filter['company_id'] = $oid;
            }
            $requestedRole = $request->query['role'] ?? null;
            if (is_string($requestedRole) && $requestedRole !== '') {
                if ($requestedRole === 'hod') {
                    $requestedRole = 'team_lead';
                }
                if (!in_array($requestedRole, Catalog::ROLES, true)) {
                    return Response::json(['success' => false, 'error' => 'Invalid user role.'], 400);
                }
                $filter['role'] = $requestedRole;
            }
            $status = $request->query['status'] ?? null;
            if (is_string($status) && $status !== '') {
                if ($status === 'active') {
                    $filter['is_active'] = true;
                } elseif ($status === 'inactive') {
                    $filter['is_active'] = false;
                } else {
                    return Response::json(['success' => false, 'error' => 'Invalid status filter.'], 400);
                }
            }
        } elseif ($role === 'admin') {
            $companyId = Scope::companyId($current);
            if ($companyId === null) {
                return Response::json(['success' => false, 'error' => 'Your admin account is not assigned to a company.'], 403);
            }
            $filter = ['company_id' => $companyId, 'role' => 'employee'];
        } elseif ($role === 'team_lead') {
            $companyId = Scope::companyId($current);
            $teamId = Scope::teamId($current);
            if ($companyId === null || $teamId === null) {
                return Response::json(['success' => true, 'users' => [], 'data' => [], 'total' => 0]);
            }
            $filter = ['company_id' => $companyId, 'team_id' => $teamId, 'role' => 'employee'];
        } else {
            return Response::json(['success' => false, 'error' => 'You do not have permission to view users.'], 403);
        }

        $search = $request->query['search'] ?? null;
        if (is_string($search) && trim($search) !== '') {
            $regex = Doc::regex(Doc::escapeRegex(trim($search)), 'i');
            $filter['$or'] = [
                ['full_name' => $regex],
                ['email' => $regex],
                ['employee_code' => $regex],
                ['phone' => $regex],
            ];
        }

        $users = $this->db->find(Collections::USERS, $filter, [
            'projection' => ['password_hash' => 0],
            'sort' => ['created_at' => -1],
        ]);
        $users = $this->db->populate($users, 'company_id', Collections::COMPANIES, ['name', 'code']);
        $formatted = array_map([AuthController::class, 'formatUser'], $users);

        return Response::json([
            'success' => true,
            'users' => $formatted,
            'data' => $formatted,
            'total' => count($formatted),
        ]);
    }

    public function show(Request $request): Response
    {
        $current = Guard::user($request);
        $id = Doc::oid($request->params['id'] ?? null);
        if ($id === null) {
            return Response::json(['success' => false, 'error' => 'Invalid user ID.'], 400);
        }
        $user = $this->db->findOne(Collections::USERS, ['_id' => $id], ['projection' => ['password_hash' => 0]]);
        if ($user === null) {
            return Response::json(['success' => false, 'error' => 'User not found.'], 404);
        }
        $user = $this->db->populateOne($user, 'company_id', Collections::COMPANIES, ['name', 'code']);

        if (($current['role'] ?? '') !== 'super_admin' && (string) $current['_id'] !== (string) $user['_id']) {
            $sameCompany = Doc::idString($current['company_id'] ?? null) === Doc::idString($user['company_id'] ?? null);
            $isEmployee = ($user['role'] ?? '') === 'employee';
            $allowed = false;
            if (($current['role'] ?? '') === 'admin' && $sameCompany && $isEmployee) {
                $allowed = true;
            }
            if (
                ($current['role'] ?? '') === 'team_lead'
                && $sameCompany
                && $isEmployee
                && Doc::idString($current['team_id'] ?? null) === Doc::idString($user['team_id'] ?? null)
            ) {
                $allowed = true;
            }
            if (!$allowed) {
                return Response::json(['success' => false, 'error' => 'You cannot view this user.'], 403);
            }
        }

        return Response::json(['success' => true, 'user' => AuthController::formatUser($user)]);
    }

    public function create(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $body = $request->body;
        $employeeCode = $body['employee_code'] ?? null;
        $email = $body['email'] ?? null;
        $fullName = $body['full_name'] ?? null;
        $password = $body['password'] ?? null;
        $phone = $body['phone'] ?? '';
        $companyId = $body['company_id'] ?? null;
        $teamId = $body['team_id'] ?? null;
        $specialization = $body['specialization'] ?? '';
        $weight = $body['assignment_weight'] ?? 1;
        $maxLeads = $body['max_open_leads'] ?? 50;

        if (!is_string($employeeCode) || trim($employeeCode) === '' || !is_string($email) || trim($email) === '' || !is_string($fullName) || trim($fullName) === '' || !is_string($password) || $password === '') {
            return Response::json(['success' => false, 'error' => 'Employee code, email, full name and password are required.'], 400);
        }
        $normalizedEmail = strtolower(trim($email));
        $normalizedCode = strtoupper(trim($employeeCode));
        if (!Guard::email($normalizedEmail)) {
            return Response::json(['success' => false, 'error' => 'Please enter a valid email address.'], 400);
        }
        if (strlen($password) < 8) {
            return Response::json(['success' => false, 'error' => 'Password must contain at least 8 characters.'], 400);
        }
        $companyOid = Doc::oid($companyId);
        if ($companyOid === null) {
            return Response::json(['success' => false, 'error' => 'A valid company must be selected.'], 400);
        }
        $company = $this->db->findOne(Collections::COMPANIES, ['_id' => $companyOid]);
        if ($company === null) {
            return Response::json(['success' => false, 'error' => 'The selected company does not exist.'], 404);
        }
        if (($company['is_active'] ?? true) === false) {
            return Response::json(['success' => false, 'error' => 'Cannot add employees to an inactive company.'], 400);
        }
        $teamOid = null;
        if ($teamId) {
            $teamOid = Doc::oid($teamId);
            if ($teamOid === null) {
                return Response::json(['success' => false, 'error' => 'Invalid team ID.'], 400);
            }
        }
        if (!is_numeric($weight) || (float) $weight < 1 || !is_numeric($maxLeads) || (int) $maxLeads < 1 || (int) $maxLeads != (float) $maxLeads) {
            return Response::json(['success' => false, 'error' => 'Assignment weight and maximum open leads must be valid positive numbers.'], 400);
        }
        if ($this->db->exists(Collections::USERS, ['$or' => [['employee_code' => $normalizedCode], ['email' => $normalizedEmail]]])) {
            return Response::json(['success' => false, 'error' => 'An account with this employee code or email already exists.'], 409);
        }

        $doc = [
            'employee_code' => $normalizedCode,
            'email' => $normalizedEmail,
            'full_name' => trim($fullName),
            'phone' => is_string($phone) ? trim($phone) : '',
            'role' => 'employee',
            'company_id' => $company['_id'],
            'specialization' => is_string($specialization) ? trim($specialization) : '',
            'assignment_weight' => (float) $weight,
            'max_open_leads' => (int) $maxLeads,
            'is_assignment_eligible' => true,
            'is_active' => true,
            'password_hash' => Password::hash($password),
            'timezone' => 'Asia/Kolkata',
            'last_login_at' => null,
            'team_id' => $teamOid,
        ];

        try {
            $user = $this->db->insert(Collections::USERS, $doc);
        } catch (Throwable $error) {
            if (Doc::duplicate($error)) {
                return Response::json(['success' => false, 'error' => 'Employee code or email already exists.'], 409);
            }
            throw $error;
        }
        unset($user['password_hash']);
        $user['company_id'] = [
            '_id' => $company['_id'],
            'name' => $company['name'] ?? '',
            'code' => $company['code'] ?? '',
        ];

        return Response::json([
            'success' => true,
            'message' => 'Employee account created successfully.',
            'user' => AuthController::formatUser($user),
        ], 201);
    }

    public function update(Request $request): Response
    {
        $current = Guard::user($request);
        $id = Doc::oid($request->params['id'] ?? null);
        if ($id === null) {
            return Response::json(['success' => false, 'error' => 'Invalid employee ID.'], 400);
        }
        $employee = $this->db->findOne(Collections::USERS, ['_id' => $id]);
        if ($employee === null) {
            return Response::json(['success' => false, 'error' => 'Employee not found.'], 404);
        }

        $self = (string) $current['_id'] === (string) $employee['_id'];
        if ($self) {
            return $this->updateSelf($employee, $request->body);
        }

        if (($employee['role'] ?? '') !== 'employee') {
            return Response::json(['success' => false, 'error' => 'Only employee accounts can be edited here.'], 403);
        }
        $isSuper = ($current['role'] ?? '') === 'super_admin';
        $isAdmin = ($current['role'] ?? '') === 'admin'
            && Doc::idString($current['company_id'] ?? null) === Doc::idString($employee['company_id'] ?? null);
        if (!$isSuper && !$isAdmin) {
            return Response::json(['success' => false, 'error' => 'You cannot edit this employee.'], 403);
        }

        $updates = $this->employeeUpdates($request->body);
        if ($updates instanceof Response) {
            return $updates;
        }
        $duplicate = $this->duplicateUser($employee, $updates);
        if ($duplicate !== null) {
            return $duplicate;
        }

        try {
            if ($updates !== []) {
                $this->db->updateOne(Collections::USERS, ['_id' => $employee['_id']], $updates);
            }
        } catch (Throwable $error) {
            if (Doc::duplicate($error)) {
                return Response::json(['success' => false, 'error' => 'Email or employee code already exists.'], 409);
            }
            throw $error;
        }

        $updated = $this->db->findOne(Collections::USERS, ['_id' => $employee['_id']], ['projection' => ['password_hash' => 0]]);
        $updated = $this->db->populateOne($updated, 'company_id', Collections::COMPANIES, ['name', 'code']);
        return Response::json([
            'success' => true,
            'message' => 'Employee details updated successfully.',
            'user' => AuthController::formatUser($updated),
        ]);
    }

    public function status(Request $request): Response
    {
        $current = Guard::user($request);
        $id = Doc::oid($request->params['id'] ?? null);
        $active = $request->body['is_active'] ?? null;
        if ($id === null) {
            return Response::json(['success' => false, 'error' => 'Invalid user ID.'], 400);
        }
        if (!is_bool($active)) {
            return Response::json(['success' => false, 'error' => 'is_active must be true or false.'], 400);
        }
        $user = $this->db->findOne(Collections::USERS, ['_id' => $id]);
        if ($user === null) {
            return Response::json(['success' => false, 'error' => 'User not found.'], 404);
        }
        if (($user['role'] ?? '') === 'super_admin') {
            return Response::json(['success' => false, 'error' => 'Super Admin accounts cannot be changed here.'], 403);
        }
        $isSuper = ($current['role'] ?? '') === 'super_admin';
        $isAdmin = ($current['role'] ?? '') === 'admin'
            && ($user['role'] ?? '') === 'employee'
            && Doc::idString($current['company_id'] ?? null) === Doc::idString($user['company_id'] ?? null);
        if (!$isSuper && !$isAdmin) {
            return Response::json(['success' => false, 'error' => 'You cannot change this user account.'], 403);
        }
        $this->db->updateOne(Collections::USERS, ['_id' => $user['_id']], ['is_active' => $active]);
        return Response::json([
            'success' => true,
            'message' => $active ? 'User activated successfully.' : 'User deactivated successfully.',
            'user' => [
                'id' => (string) $user['_id'],
                'full_name' => $user['full_name'] ?? '',
                'role' => $user['role'] ?? '',
                'is_active' => $active,
            ],
        ]);
    }

    private function updateSelf(array $employee, array $body): Response
    {
        $updates = [];
        if (array_key_exists('full_name', $body)) {
            if (!is_string($body['full_name']) || trim($body['full_name']) === '') {
                return Response::json(['success' => false, 'error' => 'Employee name is required.'], 400);
            }
            $updates['full_name'] = trim($body['full_name']);
        }
        if (array_key_exists('phone', $body)) {
            if (!is_string($body['phone'])) {
                return Response::json(['success' => false, 'error' => 'Invalid phone number.'], 400);
            }
            $updates['phone'] = trim($body['phone']);
        }
        if ($updates === []) {
            return Response::json(['success' => false, 'error' => 'No valid fields provided for update.'], 400);
        }
        $this->db->updateOne(Collections::USERS, ['_id' => $employee['_id']], $updates);
        $updated = $this->db->findOne(Collections::USERS, ['_id' => $employee['_id']], ['projection' => ['password_hash' => 0]]);
        $updated = $this->db->populateOne($updated, 'company_id', Collections::COMPANIES, ['name', 'code']);
        return Response::json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'user' => AuthController::formatUser($updated),
        ]);
    }

    private function employeeUpdates(array $body): array|Response
    {
        $updates = [];
        if (array_key_exists('employee_code', $body)) {
            if (!is_string($body['employee_code']) || trim($body['employee_code']) === '') {
                return Response::json(['success' => false, 'error' => 'Employee code is required.'], 400);
            }
            $updates['employee_code'] = strtoupper(trim($body['employee_code']));
        }
        if (array_key_exists('email', $body)) {
            $email = is_string($body['email']) ? strtolower(trim($body['email'])) : '';
            if (!Guard::email($email)) {
                return Response::json(['success' => false, 'error' => 'Enter a valid email address.'], 400);
            }
            $updates['email'] = $email;
        }
        if (array_key_exists('full_name', $body)) {
            if (!is_string($body['full_name']) || trim($body['full_name']) === '') {
                return Response::json(['success' => false, 'error' => 'Employee name is required.'], 400);
            }
            $updates['full_name'] = trim($body['full_name']);
        }
        if (array_key_exists('phone', $body)) {
            if (!is_string($body['phone'])) {
                return Response::json(['success' => false, 'error' => 'Invalid phone number.'], 400);
            }
            $updates['phone'] = trim($body['phone']);
        }
        if (array_key_exists('team_id', $body)) {
            if ($body['team_id']) {
                $team = Doc::oid($body['team_id']);
                if ($team === null) {
                    return Response::json(['success' => false, 'error' => 'Invalid team ID.'], 400);
                }
                $updates['team_id'] = $team;
            } else {
                $updates['team_id'] = null;
            }
        }
        if (array_key_exists('specialization', $body)) {
            if (!is_string($body['specialization'])) {
                return Response::json(['success' => false, 'error' => 'Invalid specialization.'], 400);
            }
            $updates['specialization'] = trim($body['specialization']);
        }
        if (array_key_exists('assignment_weight', $body)) {
            $weight = $body['assignment_weight'];
            if (!is_numeric($weight) || (float) $weight < 1) {
                return Response::json(['success' => false, 'error' => 'Assignment weight must be at least 1.'], 400);
            }
            $updates['assignment_weight'] = (float) $weight;
        }
        if (array_key_exists('max_open_leads', $body)) {
            $max = $body['max_open_leads'];
            if (!is_numeric($max) || (int) $max < 1 || (int) $max != (float) $max) {
                return Response::json(['success' => false, 'error' => 'Maximum open leads must be a positive integer.'], 400);
            }
            $updates['max_open_leads'] = (int) $max;
        }
        if (array_key_exists('is_assignment_eligible', $body)) {
            if (!is_bool($body['is_assignment_eligible'])) {
                return Response::json(['success' => false, 'error' => 'Assignment eligibility must be true or false.'], 400);
            }
            $updates['is_assignment_eligible'] = $body['is_assignment_eligible'];
        }
        return $updates;
    }

    private function duplicateUser(array $employee, array $updates): ?Response
    {
        $conditions = [];
        if (isset($updates['email'])) {
            $conditions[] = ['email' => $updates['email']];
        }
        if (isset($updates['employee_code'])) {
            $conditions[] = ['employee_code' => $updates['employee_code']];
        }
        if ($conditions === []) {
            return null;
        }
        $duplicate = $this->db->findOne(Collections::USERS, [
            '_id' => ['$ne' => $employee['_id']],
            '$or' => $conditions,
        ], ['projection' => ['_id' => 1]]);
        if ($duplicate !== null) {
            return Response::json(['success' => false, 'error' => 'Another account already uses this email or employee code.'], 409);
        }
        return null;
    }
}
