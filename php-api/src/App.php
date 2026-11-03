<?php

declare(strict_types=1);

namespace YahooCrm;

use YahooCrm\Controllers\ActivityController;
use YahooCrm\Controllers\AttendanceController;
use YahooCrm\Controllers\AuthController;
use YahooCrm\Controllers\CampaignController;
use YahooCrm\Controllers\CompanyAdminController;
use YahooCrm\Controllers\CompanyController;
use YahooCrm\Controllers\DashboardController;
use YahooCrm\Controllers\EmployeeController;
use YahooCrm\Controllers\LeadController;
use YahooCrm\Controllers\ReportController;
use YahooCrm\Controllers\UserController;

final class App
{
    public function __construct(
        private readonly Env $env,
        private readonly Database $db,
        private readonly Router $router,
    ) {
    }

    public static function boot(string $root): self
    {
        static $app = null;
        if ($app instanceof self) {
            return $app;
        }

        $env = Env::load($root);
        $db = new Database($env);
        if (!$db->ping()) {
            throw new \RuntimeException('MongoDB is not reachable.');
        }
        $app = new self($env, $db, new Router());
        $app->routes();
        return $app;
    }

    public function run(): void
    {
        try {
            $request = Request::fromGlobals();
            $response = $this->handle($request);
        } catch (HttpException $error) {
            $response = Response::json([
                'success' => false,
                'error' => $error->status >= 500 ? 'Internal server error' : $error->getMessage(),
            ], $error->status);
        } catch (\Throwable $error) {
            $this->log($error);
            $response = Response::json(['success' => false, 'error' => 'Internal server error'], 500);
        }
        $response->send();
    }

    private function handle(Request $request): Response
    {
        if ($request->path === '/api/health' || $request->path === '/api/backend/health') {
            $ok = $this->db->ping();
            return Response::json([
                'success' => $ok,
                'status' => $ok ? 'ok' : 'degraded',
                'database' => $ok ? 'connected' : 'disconnected',
            ], $ok ? 200 : 503);
        }

        if (!str_starts_with($request->path, '/api')) {
            return Response::json(['success' => false, 'error' => 'Not found'], 404);
        }

        $this->loadSession($request);
        $this->verifyCsrf($request);
        return $this->router->dispatch($request);
    }

    private function routes(): void
    {
        $auth = new AuthController($this->db, $this->env, new RateLimiter(dirname(__DIR__) . '/storage/ratelimit'));
        $companies = new CompanyController($this->db);
        $admins = new CompanyAdminController($this->db);
        $users = new UserController($this->db);
        $leads = new LeadController($this->db);
        $attendance = new AttendanceController($this->db);
        $activity = new ActivityController($this->db);
        $employee = new EmployeeController($this->db, $attendance);
        $dashboard = new DashboardController($this->db);
        $reports = new ReportController($this->db);
        $campaigns = new CampaignController($this->db);

        $this->router->map('POST', '/api/auth/login', $auth->login(...));
        $this->router->map('GET', '/api/auth/me', $auth->me(...));
        $this->router->map('POST', '/api/auth/change-password', $auth->changePassword(...));
        $this->router->map('POST', '/api/auth/logout', $auth->logout(...));

        $this->router->map('GET', '/api/companies', $companies->index(...));
        $this->router->map('POST', '/api/companies', $companies->create(...));
        $this->router->map('PATCH', '/api/companies/{id}/status', $companies->status(...));
        $this->router->map('PATCH', '/api/companies/{id}', $companies->update(...));

        $this->router->map('GET', '/api/company-admins', $admins->index(...));
        $this->router->map('POST', '/api/company-admins', $admins->create(...));
        $this->router->map('PATCH', '/api/company-admins/{id}/assign-company', $admins->assignCompany(...));
        $this->router->map('PATCH', '/api/company-admins/{id}/status', $admins->status(...));
        $this->router->map('GET', '/api/company-admins/{id}', $admins->show(...));

        $this->router->map('GET', '/api/users', $users->index(...));
        $this->router->map('POST', '/api/users', $users->create(...));
        $this->router->map('PATCH', '/api/users/{id}/status', $users->status(...));
        $this->router->map('PATCH', '/api/users/{id}', $users->update(...));
        $this->router->map('PUT', '/api/users/{id}', $users->update(...));
        $this->router->map('GET', '/api/users/{id}', $users->show(...));

        $this->router->map('GET', '/api/leads/meta', $leads->meta(...));
        $this->router->map('GET', '/api/leads/export', $leads->export(...));
        $this->router->map('POST', '/api/leads/import', $leads->import(...));
        $this->router->map('GET', '/api/leads', $leads->index(...));
        $this->router->map('POST', '/api/leads', $leads->create(...));
        $this->router->map('POST', '/api/leads/{id}/assign', $leads->assign(...));
        $this->router->map('POST', '/api/leads/{id}/notes', $leads->addNote(...));
        $this->router->map('GET', '/api/leads/{id}', $leads->show(...));
        $this->router->map('PUT', '/api/leads/{id}', $leads->update(...));

        $this->router->map('POST', '/api/attendance/check-in', $attendance->checkIn(...));
        $this->router->map('POST', '/api/attendance/check-out', $attendance->checkOut(...));
        $this->router->map('GET', '/api/attendance/me/today', $attendance->todayView(...));
        $this->router->map('POST', '/api/attendance/breaks/start', $attendance->startBreak(...));
        $this->router->map('POST', '/api/attendance/breaks/end', $attendance->endBreak(...));
        $this->router->map('GET', '/api/attendance/summary', $attendance->summary(...));
        $this->router->map('GET', '/api/attendance', $attendance->index(...));

        $this->router->map('GET', '/api/calls/analytics', $activity->callAnalytics(...));
        $this->router->map('POST', '/api/calls', $activity->createCall(...));
        $this->router->map('GET', '/api/calls', $activity->calls(...));
        $this->router->map('POST', '/api/follow-ups/escalate', $activity->escalate(...));
        $this->router->map('POST', '/api/follow-ups', $activity->createFollowUp(...));
        $this->router->map('GET', '/api/follow-ups', $activity->followUps(...));
        $this->router->map('PUT', '/api/follow-ups/{id}', $activity->updateFollowUp(...));
        $this->router->map('POST', '/api/site-visits', $activity->createVisit(...));
        $this->router->map('GET', '/api/site-visits', $activity->visits(...));
        $this->router->map('PUT', '/api/site-visits/{id}', $activity->updateVisit(...));

        $this->router->map('GET', '/api/employee/workspace', $employee->workspace(...));
        $this->router->map('GET', '/api/employee/attendance', $employee->attendance(...));
        $this->router->map('GET', '/api/dashboard', $dashboard->index(...));

        $this->router->map('GET', '/api/reports/companies', $reports->companies(...));
        $this->router->map('GET', '/api/reports/company/{companyId}', $reports->company(...));
        $this->router->map('GET', '/api/reports/my-performance', $reports->mine(...));
        $this->router->map('GET', '/api/reports/performance', $reports->performance(...));
        $this->router->map('GET', '/api/reports/lead-conversion', $reports->conversion(...));
        $this->router->map('GET', '/api/reports/assignments', $reports->assignments(...));

        $this->router->map('GET', '/api/campaigns', $campaigns->index(...));
        $this->router->map('POST', '/api/campaigns', $campaigns->create(...));
        $this->router->map('POST', '/api/campaigns/{id}/activate', $campaigns->activate(...));
        $this->router->map('POST', '/api/campaigns/{id}/pause', $campaigns->pause(...));
        $this->router->map('POST', '/api/campaigns/{id}/enroll', $campaigns->enroll(...));
        $this->router->map('GET', '/api/campaigns/{id}/enrollments', $campaigns->enrollments(...));
        $this->router->map('GET', '/api/campaigns/{id}', $campaigns->show(...));
        $this->router->map('PATCH', '/api/campaigns/{id}', $campaigns->update(...));
    }

    private function loadSession(Request $request): void
    {
        $token = $request->cookie(Tokens::COOKIE);
        if ($token === '') {
            return;
        }
        $session = $this->db->findOne(Collections::SESSIONS, [
            'token_hash' => Tokens::hash($token),
            'expires_at' => ['$gt' => Doc::date()],
        ]);
        if ($session === null) {
            return;
        }
        $user = $this->db->findOne(Collections::USERS, ['_id' => $session['user']]);
        if ($user === null || !Scope::active($user)) {
            $this->db->deleteOne(Collections::SESSIONS, ['_id' => $session['_id']]);
            return;
        }
        unset($user['password_hash']);
        $request->session = $session;
        $request->user = $user;
    }

    private function verifyCsrf(Request $request): void
    {
        if (in_array($request->method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        if ($request->path === '/api/auth/login') {
            return;
        }
        if ($request->session === null) {
            return;
        }
        $expected = (string) ($request->session['csrf_token'] ?? '');
        $given = $request->header('x-csrf-token');
        if ($given === '' || strlen($given) !== strlen($expected) || !Tokens::equals($expected, $given)) {
            throw new HttpException(403, 'Invalid or missing CSRF token. Refresh the page and try again.');
        }
    }

    private function log(\Throwable $error): void
    {
        $dir = dirname(__DIR__) . '/storage/logs';
        if (!is_dir($dir)) {
            mkdir($dir, 0700, true);
        }
        $message = $this->env->redact($error->getMessage());
        file_put_contents(
            $dir . '/app.log',
            gmdate('c') . ' ' . $message . PHP_EOL,
            FILE_APPEND,
        );
    }
}
