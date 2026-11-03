<?php

declare(strict_types=1);

namespace YahooCrm\Controllers;

use YahooCrm\Catalog;
use YahooCrm\Clock;
use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Guard;
use YahooCrm\Request;
use YahooCrm\Response;
use YahooCrm\Scope;

final class DashboardController
{
    public function __construct(private readonly Database $db)
    {
    }

    public function index(Request $request): Response
    {
        $user = Guard::user($request);
        if (!in_array($user['role'] ?? '', ['admin', 'team_lead'], true)) {
            return Response::json(['success' => false, 'error' => 'Company dashboard access required.'], 403);
        }
        $companyId = Scope::companyId($user);
        if ($companyId === null) {
            return Response::json(['success' => false, 'error' => 'Your account is not assigned to a company.'], 403);
        }
        $timezone = $user['timezone'] ?? 'Asia/Kolkata';
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $today = Clock::dateKey($now, $timezone);
        $tomorrow = Clock::addDays($today, 1);
        $sevenDaysAgo = Clock::addDays($today, -6);
        $start = Doc::date(Clock::zonedMidnightToUtc($today, $timezone));
        $end = Doc::date(Clock::zonedMidnightToUtc($tomorrow, $timezone));
        $trendStart = Doc::date(Clock::zonedMidnightToUtc($sevenDaysAgo, $timezone));

        $userFilter = [
            'company_id' => $companyId,
            'role' => ['$in' => ['employee', 'team_lead']],
        ];
        if (($user['role'] ?? '') === 'team_lead') {
            $or = [['_id' => $user['_id']]];
            $teamId = Scope::teamId($user);
            if ($teamId !== null) {
                $or[] = ['team_id' => $teamId, 'role' => 'employee'];
            }
            $userFilter['$or'] = $or;
        }
        $visibleUsers = $this->db->find(Collections::USERS, $userFilter, [
            'projection' => ['_id' => 1, 'full_name' => 1, 'employee_code' => 1, 'role' => 1, 'team_id' => 1, 'is_active' => 1],
            'sort' => ['full_name' => 1],
        ]);
        $visibleIds = array_map(static fn (array $item) => $item['_id'], $visibleUsers);
        $leadFilter = ['company_id' => $companyId];
        $attendanceFilter = ['company_id' => $companyId, 'work_date' => $today];
        if (($user['role'] ?? '') === 'team_lead') {
            $leadFilter['owner'] = ['$in' => $visibleIds];
            $attendanceFilter['user'] = ['$in' => $visibleIds];
        }

        $activeEmployees = $this->db->count(Collections::USERS, $userFilter + ['is_active' => true]);
        $attendanceToday = $this->db->count(Collections::ATTENDANCES, $attendanceFilter);
        $leadsToday = $this->db->count(Collections::LEADS, $leadFilter + ['created_at' => ['$gte' => $start, '$lt' => $end]]);
        $unassigned = ($user['role'] ?? '') === 'admin'
            ? $this->db->count(Collections::LEADS, $leadFilter + ['owner' => null])
            : 0;
        $overdue = $this->db->count(Collections::LEADS, $leadFilter + [
            'next_follow_up_at' => ['$ne' => null, '$lt' => Doc::date($now)],
            'status_id' => ['$ne' => 4],
        ]);
        $statusCounts = $this->db->aggregate(Collections::LEADS, [
            ['$match' => $leadFilter],
            ['$group' => ['_id' => '$status_id', 'cnt' => ['$sum' => 1]]],
        ]);
        $trendCounts = $this->db->aggregate(Collections::LEADS, [
            ['$match' => $leadFilter + ['created_at' => ['$gte' => $trendStart, '$lt' => $end]]],
            ['$group' => ['_id' => ['$dateToString' => ['format' => '%Y-%m-%d', 'date' => '$created_at', 'timezone' => $timezone]], 'leads' => ['$sum' => 1]]],
        ]);
        $employeeLeadStats = $this->db->aggregate(Collections::LEADS, [
            ['$match' => $leadFilter + ['owner' => ['$ne' => null]]],
            ['$group' => [
                '_id' => '$owner',
                'total_leads' => ['$sum' => 1],
                'interested_leads' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 2]], 1, 0]]],
                'not_interested' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 4]], 1, 0]]],
            ]],
        ]);
        $overdueByOwner = $this->db->aggregate(Collections::LEADS, [
            ['$match' => $leadFilter + [
                'owner' => ['$ne' => null],
                'next_follow_up_at' => ['$ne' => null, '$lt' => Doc::date($now)],
                'status_id' => ['$ne' => 4],
            ]],
            ['$group' => ['_id' => '$owner', 'overdue_tasks' => ['$sum' => 1]]],
        ]);

        $statusMap = [];
        foreach ($statusCounts as $item) {
            $statusMap[(int) $item['_id']] = (int) $item['cnt'];
        }
        $leadsByStatus = array_map(static fn (array $status): array => [
            'id' => $status['id'],
            'name' => $status['name'],
            'cnt' => $statusMap[$status['id']] ?? 0,
        ], Catalog::STATUSES);

        $trendMap = [];
        foreach ($trendCounts as $item) {
            $trendMap[(string) $item['_id']] = (int) $item['leads'];
        }
        $trend = [];
        for ($i = 0; $i < 7; $i++) {
            $date = Clock::addDays($sevenDaysAgo, $i);
            $labelDate = new \DateTimeImmutable($date . 'T12:00:00Z');
            $trend[] = [
                'date' => $date,
                'label' => $labelDate->format('d M'),
                'leads' => $trendMap[$date] ?? 0,
            ];
        }

        $statsMap = [];
        foreach ($employeeLeadStats as $item) {
            $statsMap[(string) $item['_id']] = $item;
        }
        $overdueMap = [];
        foreach ($overdueByOwner as $item) {
            $overdueMap[(string) $item['_id']] = (int) $item['overdue_tasks'];
        }
        $performance = [];
        foreach ($visibleUsers as $employee) {
            $id = (string) $employee['_id'];
            $stats = $statsMap[$id] ?? [];
            $total = (int) ($stats['total_leads'] ?? 0);
            $interested = (int) ($stats['interested_leads'] ?? 0);
            $notInterested = (int) ($stats['not_interested'] ?? 0);
            $performance[] = [
                'id' => $id,
                'name' => $employee['full_name'] ?? '',
                'role' => $employee['role'] ?? '',
                'is_active' => (bool) ($employee['is_active'] ?? false),
                'total_leads' => $total,
                'interested_leads' => $interested,
                'not_interested' => $notInterested,
                'interest_rate' => $total ? round(($interested / $total) * 1000) / 10 : 0,
                'overdue_tasks' => $overdueMap[$id] ?? 0,
                'open_leads' => max(0, $total - $notInterested),
            ];
        }
        usort($performance, static fn (array $a, array $b): int => $b['total_leads'] <=> $a['total_leads']);

        return Response::json([
            'success' => true,
            'data' => [
                'role' => $user['role'],
                'company_id' => (string) $companyId,
                'generated_at' => Doc::iso($now),
                'kpis' => [
                    'active_employees' => $activeEmployees,
                    'attendance_today' => $attendanceToday,
                    'leads_today' => $leadsToday,
                    'unassigned_leads' => $unassigned,
                    'overdue_followups' => $overdue,
                ],
                'leads_by_status' => $leadsByStatus,
                'trend' => $trend,
                'employee_performance' => $performance,
                'members' => $performance,
                'workload' => $performance,
                'metrics_definitions' => [
                    'interest_rate' => 'Interested leads divided by total assigned leads.',
                    'open_leads' => 'Assigned leads excluding leads marked Not interested.',
                    'attendance_today' => 'Number of attendance records for the current company work date.',
                ],
            ],
        ]);
    }
}
