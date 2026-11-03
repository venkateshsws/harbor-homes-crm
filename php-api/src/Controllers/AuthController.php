<?php

declare(strict_types=1);

namespace YahooCrm\Controllers;

use YahooCrm\Catalog;
use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Env;
use YahooCrm\HttpException;
use YahooCrm\Password;
use YahooCrm\RateLimiter;
use YahooCrm\Request;
use YahooCrm\Response;
use YahooCrm\Scope;
use YahooCrm\Tokens;

final class AuthController
{
    public function __construct(
        private readonly Database $db,
        private readonly Env $env,
        private readonly RateLimiter $limiter,
    ) {
    }

    public function login(Request $request): Response
    {
        if ($this->limiter->blocked($request->ip, 10, 900)) {
            return Response::json([
                'success' => false,
                'error' => 'Too many sign-in attempts. Try again in 15 minutes.',
            ], 429);
        }

        $identifier = $request->body['identifier'] ?? null;
        $password = $request->body['password'] ?? null;
        if (!is_string($identifier) || !is_string($password) || trim($identifier) === '' || $password === '') {
            return Response::json([
                'success' => false,
                'error' => 'Enter your email or employee ID and password.',
            ], 400);
        }

        $id = trim($identifier);
        $user = $this->db->findOne(Collections::USERS, [
            '$or' => [
                ['email' => strtolower($id)],
                ['employee_code' => strtoupper($id)],
            ],
        ]);

        $valid = Password::verify($password, isset($user['password_hash']) ? (string) $user['password_hash'] : null);
        if ($user === null || !$valid) {
            $this->limiter->hit($request->ip, 900);
            return Response::json([
                'success' => false,
                'error' => 'Invalid email, employee ID, or password.',
            ], 401);
        }

        if (!Scope::active($user)) {
            return Response::json([
                'success' => false,
                'error' => 'This account has been deactivated. Contact your administrator.',
            ], 403);
        }

        if ($request->session !== null) {
            $this->db->deleteOne(Collections::SESSIONS, ['_id' => $request->session['_id']]);
        }

        $token = Tokens::random();
        $ttl = $this->env->sessionTtlHours * 3600;
        $expires = Doc::date((new \DateTimeImmutable())->modify('+' . $ttl . ' seconds'));
        $session = $this->db->insert(Collections::SESSIONS, [
            'token_hash' => Tokens::hash($token),
            'user' => $user['_id'],
            'csrf_token' => Tokens::random(24),
            'expires_at' => $expires,
            'ip' => $request->ip !== '' ? $request->ip : null,
            'user_agent' => $request->userAgent,
        ]);

        $this->db->updateOne(Collections::USERS, ['_id' => $user['_id']], [
            'last_login_at' => Doc::date(),
        ]);
        $user['last_login_at'] = Doc::date();

        $response = Response::json([
            'success' => true,
            'data' => [
                'user' => self::sessionUser($user),
                'csrf_token' => $session['csrf_token'],
            ],
        ]);
        return $response->cookie(Tokens::COOKIE, $token, $ttl, $this->env->isProduction());
    }

    public function me(Request $request): Response
    {
        $user = $this->requireUser($request);
        return Response::json([
            'success' => true,
            'data' => [
                'user' => self::sessionUser($user),
                'csrf_token' => $request->session['csrf_token'] ?? null,
            ],
        ]);
    }

    public function changePassword(Request $request): Response
    {
        $current = $this->requireUser($request);
        $currentPassword = $request->body['current_password'] ?? null;
        $newPassword = $request->body['new_password'] ?? null;
        if (!is_string($currentPassword) || !is_string($newPassword) || $currentPassword === '' || $newPassword === '') {
            return Response::json([
                'success' => false,
                'error' => 'Enter your current password and a new password.',
            ], 400);
        }
        $problem = Password::problem($newPassword);
        if ($problem !== null) {
            return Response::json([
                'success' => false,
                'error' => preg_replace('/^Password/', 'New password', $problem),
            ], 400);
        }
        if ($newPassword === $currentPassword) {
            return Response::json([
                'success' => false,
                'error' => 'New password must be different from the current password.',
            ], 400);
        }

        $user = $this->db->findOne(Collections::USERS, ['_id' => $current['_id']]);
        if ($user === null || !Scope::active($user)) {
            return Response::json([
                'success' => false,
                'error' => 'This account has been deactivated. Contact your administrator.',
            ], 403);
        }
        if (!Password::verify($currentPassword, (string) ($user['password_hash'] ?? ''))) {
            return Response::json([
                'success' => false,
                'error' => 'Current password is incorrect.',
            ], 400);
        }

        $this->db->updateOne(Collections::USERS, ['_id' => $user['_id']], [
            'password_hash' => Password::hash($newPassword),
        ]);
        $this->db->deleteMany(Collections::SESSIONS, ['user' => $user['_id']]);

        $response = Response::json(['success' => true, 'data' => Response::emptyObject()]);
        return $response->clearCookie(Tokens::COOKIE, $this->env->isProduction());
    }

    public function logout(Request $request): Response
    {
        if ($request->session !== null) {
            $this->db->deleteOne(Collections::SESSIONS, ['_id' => $request->session['_id']]);
        }
        $response = Response::json(['success' => true, 'data' => Response::emptyObject()]);
        return $response->clearCookie(Tokens::COOKIE, $this->env->isProduction());
    }

    public static function sessionUser(array $user): array
    {
        return [
            'id' => (string) $user['_id'],
            'employee_code' => $user['employee_code'] ?? '',
            'email' => $user['email'] ?? '',
            'full_name' => $user['full_name'] ?? '',
            'phone' => $user['phone'] ?? null,
            'role' => $user['role'] ?? '',
            'role_name' => Catalog::ROLE_NAMES[$user['role'] ?? ''] ?? ($user['role'] ?? ''),
            'company_id' => Doc::idString($user['company_id'] ?? null),
            'team_id' => Doc::idString($user['team_id'] ?? null),
            'specialization' => $user['specialization'] ?? null,
            'assignment_weight' => $user['assignment_weight'] ?? 1,
            'max_open_leads' => $user['max_open_leads'] ?? 50,
            'is_assignment_eligible' => (bool) ($user['is_assignment_eligible'] ?? false),
            'is_active' => (bool) ($user['is_active'] ?? false),
            'last_login_at' => Doc::sql($user['last_login_at'] ?? null),
            'timezone' => $user['timezone'] ?? 'Asia/Kolkata',
        ];
    }

    public static function formatUser(array $user): array
    {
        $company = is_array($user['company_id'] ?? null) ? $user['company_id'] : null;
        return [
            'id' => (string) $user['_id'],
            'employee_code' => $user['employee_code'] ?? '',
            'email' => $user['email'] ?? '',
            'full_name' => $user['full_name'] ?? '',
            'phone' => $user['phone'] ?? '',
            'role' => $user['role'] ?? '',
            'role_name' => Catalog::ROLE_NAMES[$user['role'] ?? ''] ?? ($user['role'] ?? ''),
            'company_id' => $company ? (string) $company['_id'] : Doc::idString($user['company_id'] ?? null),
            'company_name' => $company['name'] ?? 'Unassigned',
            'company_code' => $company['code'] ?? '',
            'team_id' => Doc::idString($user['team_id'] ?? null),
            'specialization' => $user['specialization'] ?? '',
            'assignment_weight' => $user['assignment_weight'] ?? 1,
            'max_open_leads' => $user['max_open_leads'] ?? 50,
            'is_assignment_eligible' => (bool) ($user['is_assignment_eligible'] ?? false),
            'is_active' => (bool) ($user['is_active'] ?? false),
            'last_login_at' => Doc::iso($user['last_login_at'] ?? null),
            'created_at' => Doc::iso($user['created_at'] ?? null),
            'updated_at' => Doc::iso($user['updated_at'] ?? null),
        ];
    }

    private function requireUser(Request $request): array
    {
        if ($request->user === null) {
            throw new HttpException(401, 'Sign in required.');
        }
        return $request->user;
    }
}
