<?php

declare(strict_types=1);

namespace YahooCrm\Controllers;

use YahooCrm\Catalog;
use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Guard;
use YahooCrm\HttpException;
use YahooCrm\Request;
use YahooCrm\Response;
use YahooCrm\Scope;
use MongoDB\BSON\ObjectId;

final class ReportController
{
    public function __construct(private readonly Database $db)
    {
    }

    public function companies(Request $request): Response
    {
        Guard::role($request, ['super_admin']);
        $range = $this->range($request);
        $companies = $this->db->find(Collections::COMPANIES, [], ['sort' => ['name' => 1]]);
        $data = [];
        foreach ($companies as $company) {
            $data[] = [
                'id' => (string) $company['_id'],
                'name' => $company['name'] ?? '',
                'code' => $company['code'] ?? '',
                'admin_name' => $company['admin_name'] ?? '',
                'admin_email' => $company['admin_email'] ?? '',
                'is_active' => (bool) ($company['is_active'] ?? false),
                'total_leads' => $this->db->count(Collections::LEADS, ['company_id' => $company['_id']] + $this->dateFilter($range)),
                'active_employees' => $this->db->count(Collections::USERS, [
                    'company_id' => $company['_id'],
                    'role' => ['$in' => ['team_lead', 'employee']],
                    'is_active' => true,
                ]),
                'attendance_records' => $this->db->count(Collections::ATTENDANCES, ['company_id' => $company['_id']] + $this->attendanceFilter($range)),
            ];
        }
        return Response::json(['success' => true, 'data' => $data]);
    }

    public function company(Request $request): Response
    {
        $user = Guard::user($request);
        $companyId = $this->companyScope($user, $request->params['companyId'] ?? null);
        return Response::json(['success' => true, 'data' => $this->build($user, $companyId, $this->range($request))]);
    }

    public function mine(Request $request): Response
    {
        $user = Guard::role($request, ['team_lead', 'employee']);
        if (Scope::companyId($user) === null) {
            return Response::json(['success' => false, 'error' => 'Your account is not assigned to a company.'], 403);
        }
        return Response::json(['success' => true, 'data' => $this->build($user, Scope::companyId($user), $this->range($request))]);
    }

    public function performance(Request $request): Response
    {
        $user = Guard::user($request);
        $companyId = ($user['role'] ?? '') === 'super_admin' ? null : Scope::companyId($user);
        if (($user['role'] ?? '') !== 'super_admin' && $companyId === null) {
            return Response::json(['success' => false, 'error' => 'Your account is not assigned to a company.'], 403);
        }
        $leadFilter = $companyId ? ['company_id' => $companyId] : [];
        $userFilter = $companyId ? ['company_id' => $companyId] : [];
        if (($user['role'] ?? '') === 'employee') {
            $leadFilter['owner'] = $user['_id'];
            $userFilter['_id'] = $user['_id'];
        } elseif (($user['role'] ?? '') === 'team_lead') {
            $ids = Scope::activityUserIds($this->db, $user);
            $leadFilter['owner'] = ['$in' => $ids];
            $userFilter['_id'] = ['$in' => $ids];
        } else {
            $userFilter['role'] = ['$in' => ['employee', 'team_lead']];
        }
        $people = $this->db->find(Collections::USERS, $userFilter, ['sort' => ['full_name' => 1]]);
        $rows = [];
        foreach ($people as $person) {
            $ownedFilter = $leadFilter;
            $ownedFilter['owner'] = $person['_id'];
            $owned = $this->db->count(Collections::LEADS, $ownedFilter);
            $convertedFilter = $ownedFilter;
            $convertedFilter['status_id'] = 2;
            $conversions = $this->db->count(Collections::LEADS, $convertedFilter);
            $calls = $this->db->count(Collections::LEADCALLS, ['employee_id' => $person['_id']] + ($companyId ? ['company_id' => $companyId] : []));
            $done = $this->db->count(Collections::FOLLOWUPS, ['employee_id' => $person['_id'], 'status' => 'completed'] + ($companyId ? ['company_id' => $companyId] : []));
            $overdue = $this->db->count(Collections::FOLLOWUPS, [
                'employee_id' => $person['_id'],
                'status' => 'pending',
                'due_at' => ['$lt' => Doc::date()],
            ] + ($companyId ? ['company_id' => $companyId] : []));
            $rows[] = [
                'id' => (string) $person['_id'],
                'full_name' => $person['full_name'] ?? '',
                'team_name' => null,
                'leads_owned' => $owned,
                'conversions' => $conversions,
                'conversion_rate' => $owned ? round(($conversions / $owned) * 1000) / 10 : 0,
                'calls_logged' => $calls,
                'followups_completed' => $done,
                'overdue_followups' => $overdue,
            ];
        }
        return Response::json([
            'success' => true,
            'data' => $rows,
            'meta' => [
                'definitions' => [
                    'conversions' => 'Leads currently in the Interested status. The database has no separate converted status.',
                    'conversion_rate' => 'Interested leads divided by leads owned.',
                    'calls_logged' => 'Employee-reported call records.',
                    'overdue_followups' => 'Pending follow-ups whose due time has passed.',
                ],
            ],
        ]);
    }

    public function conversion(Request $request): Response
    {
        $user = Guard::user($request);
        $filter = ($user['role'] ?? '') === 'super_admin' ? [] : Scope::companyFilter($user);
        if (($user['role'] ?? '') === 'employee') {
            $filter = Scope::combine($filter, ['owner' => $user['_id']]);
        } elseif (($user['role'] ?? '') === 'team_lead') {
            $filter = Scope::combine($filter, ['owner' => ['$in' => Scope::activityUserIds($this->db, $user)]]);
        }
        $start = (new \DateTimeImmutable('today', new \DateTimeZone('UTC')))->modify('-29 days');
        $rows = $this->db->aggregate(Collections::LEADS, [
            ['$match' => $filter + ['created_at' => ['$gte' => Doc::date($start)]]],
            ['$group' => [
                '_id' => ['$dateToString' => ['format' => '%Y-%m-%d', 'date' => '$created_at', 'timezone' => 'UTC']],
                'leads' => ['$sum' => 1],
                'conversions' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 2]], 1, 0]]],
            ]],
        ]);
        $map = [];
        foreach ($rows as $row) {
            $map[(string) $row['_id']] = $row;
        }
        $points = [];
        for ($i = 0; $i < 30; $i++) {
            $day = $start->modify('+' . $i . ' days')->format('Y-m-d');
            $points[] = [
                'day' => $day,
                'leads' => (int) ($map[$day]['leads'] ?? 0),
                'conversions' => (int) ($map[$day]['conversions'] ?? 0),
            ];
        }
        return Response::json(['success' => true, 'data' => $points]);
    }

    public function assignments(Request $request): Response
    {
        $user = Guard::user($request);
        $filter = ($user['role'] ?? '') === 'super_admin' ? [] : ['company_id' => Scope::requireCompany($user)];
        $rows = $this->db->aggregate(Collections::LEADASSIGNMENTS, [
            ['$match' => $filter],
            ['$group' => ['_id' => '$method', 'cnt' => ['$sum' => 1]]],
            ['$sort' => ['cnt' => -1]],
        ]);
        return Response::json([
            'success' => true,
            'data' => array_map(static fn (array $row): array => [
                'method' => (string) ($row['_id'] ?? 'unknown'),
                'cnt' => (int) $row['cnt'],
            ], $rows),
        ]);
    }

    private function build(array $user, ObjectId $companyId, array $range): array
    {
        $company = $this->db->findOne(Collections::COMPANIES, ['_id' => $companyId]);
        if ($company === null) {
            throw new HttpException(404, 'Company not found.');
        }
        $visible = $this->visibleUsers($user, $companyId);
        $userIds = array_map(static fn (array $item) => $item['_id'], $visible);
        $leadFilter = ['company_id' => $companyId] + $this->dateFilter($range);
        $attendanceFilter = ['company_id' => $companyId] + $this->attendanceFilter($range);
        if (in_array($user['role'] ?? '', ['team_lead', 'employee'], true)) {
            $leadFilter['owner'] = ['$in' => $userIds];
            $attendanceFilter['user'] = ['$in' => $userIds];
        }
        $trendRange = $this->trendRange($range);
        $leadStats = $this->db->aggregate(Collections::LEADS, [
            ['$match' => $leadFilter],
            ['$group' => [
                '_id' => null,
                'total' => ['$sum' => 1],
                'unassigned' => ['$sum' => ['$cond' => [['$eq' => ['$owner', null]], 1, 0]]],
                'new' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 1]], 1, 0]]],
                'interested' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 2]], 1, 0]]],
                'site_visit_scheduled' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 3]], 1, 0]]],
                'not_interested' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 4]], 1, 0]]],
                'follow_up' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 5]], 1, 0]]],
            ]],
        ]);
        $employeeLeadStats = $this->db->aggregate(Collections::LEADS, [
            ['$match' => $leadFilter + ['owner' => ['$ne' => null]]],
            ['$group' => [
                '_id' => '$owner',
                'total_leads' => ['$sum' => 1],
                'new' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 1]], 1, 0]]],
                'interested' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 2]], 1, 0]]],
                'site_visit_scheduled' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 3]], 1, 0]]],
                'not_interested' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 4]], 1, 0]]],
                'follow_up' => ['$sum' => ['$cond' => [['$eq' => ['$status_id', 5]], 1, 0]]],
            ]],
        ]);
        $leadTrend = $this->db->aggregate(Collections::LEADS, [
            ['$match' => $leadFilter + ['created_at' => ['$gte' => Doc::date($trendRange['start']), '$lte' => Doc::date($trendRange['end'])]]],
            ['$group' => [
                '_id' => ['$dateToString' => [
                    'format' => $trendRange['interval'] === 'day' ? '%Y-%m-%d' : '%Y-%m',
                    'date' => '$created_at',
                    'timezone' => 'UTC',
                ]],
                'total' => ['$sum' => 1],
            ]],
            ['$sort' => ['_id' => 1]],
        ]);
        $attendanceRecords = $this->db->find(Collections::ATTENDANCES, $attendanceFilter, ['sort' => ['work_date' => -1, 'login_at' => -1]]);

        $summary = $leadStats[0] ?? [
            'total' => 0, 'unassigned' => 0, 'new' => 0, 'interested' => 0,
            'site_visit_scheduled' => 0, 'not_interested' => 0, 'follow_up' => 0,
        ];
        unset($summary['_id']);
        $statsMap = [];
        foreach ($employeeLeadStats as $item) {
            $statsMap[(string) $item['_id']] = $item;
        }
        $attendanceMap = [];
        foreach ($attendanceRecords as $record) {
            $id = (string) $record['user'];
            $time = $this->workingSeconds($record);
            $attendanceMap[$id] ??= [
                'attendance_days' => 0,
                'total_working_seconds' => 0,
                'total_break_seconds' => 0,
                'checked_out_days' => 0,
                'open_sessions' => 0,
            ];
            $attendanceMap[$id]['attendance_days']++;
            $attendanceMap[$id]['total_working_seconds'] += $time['working_seconds'];
            $attendanceMap[$id]['total_break_seconds'] += $time['break_seconds'];
            if (!empty($record['logout_at'])) {
                $attendanceMap[$id]['checked_out_days']++;
            } else {
                $attendanceMap[$id]['open_sessions']++;
            }
        }
        $employees = [];
        foreach ($visible as $employee) {
            $id = (string) $employee['_id'];
            $leads = $statsMap[$id] ?? [];
            $employees[] = [
                'id' => $id,
                'full_name' => $employee['full_name'] ?? '',
                'employee_code' => $employee['employee_code'] ?? '',
                'email' => $employee['email'] ?? '',
                'role' => $employee['role'] ?? '',
                'is_active' => (bool) ($employee['is_active'] ?? false),
                'total_leads' => (int) ($leads['total_leads'] ?? 0),
                'new' => (int) ($leads['new'] ?? 0),
                'interested' => (int) ($leads['interested'] ?? 0),
                'site_visit_scheduled' => (int) ($leads['site_visit_scheduled'] ?? 0),
                'not_interested' => (int) ($leads['not_interested'] ?? 0),
                'follow_up' => (int) ($leads['follow_up'] ?? 0),
                'attendance' => $attendanceMap[$id] ?? [
                    'attendance_days' => 0,
                    'total_working_seconds' => 0,
                    'total_break_seconds' => 0,
                    'checked_out_days' => 0,
                    'open_sessions' => 0,
                ],
            ];
        }
        $working = 0;
        $breaks = 0;
        foreach ($attendanceMap as $item) {
            $working += $item['total_working_seconds'];
            $breaks += $item['total_break_seconds'];
        }
        return [
            'company' => [
                'id' => (string) $company['_id'],
                'name' => $company['name'] ?? '',
                'code' => $company['code'] ?? '',
                'admin_name' => $company['admin_name'] ?? '',
                'admin_email' => $company['admin_email'] ?? '',
                'phone' => $company['phone'] ?? null,
                'is_active' => (bool) ($company['is_active'] ?? false),
            ],
            'period' => ['from' => $range['from'], 'to' => $range['to']],
            'leads' => $summary,
            'statuses' => Catalog::STATUSES,
            'lead_trend' => [
                'interval' => $trendRange['interval'],
                'from' => $trendRange['start']->format('Y-m-d\TH:i:s.v\Z'),
                'to' => $trendRange['end']->format('Y-m-d\TH:i:s.v\Z'),
                'points' => $this->trendPoints($leadTrend, $trendRange),
            ],
            'employees' => $employees,
            'attendance' => [
                'total_records' => count($attendanceRecords),
                'checked_out' => count(array_filter($attendanceRecords, static fn (array $item): bool => !empty($item['logout_at']))),
                'currently_checked_in' => count(array_filter($attendanceRecords, static fn (array $item): bool => empty($item['logout_at']))),
                'total_working_seconds' => $working,
                'total_break_seconds' => $breaks,
            ],
        ];
    }

    private function visibleUsers(array $user, ObjectId $companyId): array
    {
        if (in_array($user['role'] ?? '', ['super_admin', 'admin'], true)) {
            return $this->db->find(Collections::USERS, [
                'company_id' => $companyId,
                'role' => ['$in' => ['admin', 'team_lead', 'employee']],
            ]);
        }
        if (($user['role'] ?? '') === 'team_lead') {
            if (Scope::teamId($user) === null) {
                return [$user];
            }
            return $this->db->find(Collections::USERS, [
                'company_id' => $companyId,
                '$or' => [
                    ['_id' => $user['_id']],
                    ['team_id' => Scope::teamId($user), 'role' => 'employee'],
                ],
            ]);
        }
        return [$user];
    }

    private function companyScope(array $user, mixed $requested): ObjectId
    {
        if (($user['role'] ?? '') === 'super_admin') {
            $id = Doc::oid($requested);
            if ($id === null) {
                throw new HttpException(400, 'A valid company ID is required.');
            }
            return $id;
        }
        if (($user['role'] ?? '') === 'admin') {
            $own = Scope::companyId($user);
            if ($own === null) {
                throw new HttpException(403, 'Your account is not assigned to a company.');
            }
            if ($requested && (string) $requested !== (string) $own) {
                throw new HttpException(403, 'You cannot access another company report.');
            }
            return $own;
        }
        throw new HttpException(403, 'You are not allowed to access company reports.');
    }

    private function range(Request $request): array
    {
        $from = isset($request->query['from']) ? (string) $request->query['from'] : null;
        $to = isset($request->query['to']) ? (string) $request->query['to'] : null;
        if (($from && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) || ($to && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to))) {
            throw new HttpException(400, 'Dates must use YYYY-MM-DD format.');
        }
        $start = $from ? Doc::parseDate($from . 'T00:00:00.000Z') : null;
        $end = $to ? Doc::parseDate($to . 'T23:59:59.999Z') : null;
        if ($from && $start === null) {
            throw new HttpException(400, 'Invalid start date.');
        }
        if ($to && $end === null) {
            throw new HttpException(400, 'Invalid end date.');
        }
        if ($start && $end && $start > $end) {
            throw new HttpException(400, 'Start date cannot be after end date.');
        }
        return ['start' => $start, 'end' => $end, 'from' => $from, 'to' => $to];
    }

    private function dateFilter(array $range): array
    {
        $created = [];
        if ($range['start']) {
            $created['$gte'] = Doc::date($range['start']);
        }
        if ($range['end']) {
            $created['$lte'] = Doc::date($range['end']);
        }
        return $created === [] ? [] : ['created_at' => $created];
    }

    private function attendanceFilter(array $range): array
    {
        $work = [];
        if ($range['from']) {
            $work['$gte'] = $range['from'];
        }
        if ($range['to']) {
            $work['$lte'] = $range['to'];
        }
        return $work === [] ? [] : ['work_date' => $work];
    }

    private function trendRange(array $range): array
    {
        $end = $range['end'] ?? new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $start = $range['start'];
        if ($start === null) {
            $start = $end->setDate((int) $end->format('Y'), (int) $end->format('n'), 1)->modify('-5 months')->setTime(0, 0, 0);
        }
        $days = (int) ceil(($end->getTimestamp() - $start->getTimestamp()) / 86400);
        return ['start' => $start, 'end' => $end, 'interval' => $days <= 31 ? 'day' : 'month'];
    }

    private function trendPoints(array $aggregated, array $trendRange): array
    {
        $map = [];
        foreach ($aggregated as $item) {
            $map[(string) $item['_id']] = (int) ($item['total'] ?? 0);
        }
        $points = [];
        $current = $trendRange['start']->setTime(0, 0, 0);
        $last = $trendRange['end']->setTime(0, 0, 0);
        if ($trendRange['interval'] === 'day') {
            while ($current <= $last) {
                $key = $current->format('Y-m-d');
                $points[] = ['date' => $key, 'total' => $map[$key] ?? 0];
                $current = $current->modify('+1 day');
            }
        } else {
            $current = $current->modify('first day of this month');
            $last = $last->modify('first day of this month');
            while ($current <= $last) {
                $key = $current->format('Y-m');
                $points[] = ['date' => $key, 'total' => $map[$key] ?? 0];
                $current = $current->modify('+1 month');
            }
        }
        return $points;
    }

    private function workingSeconds(array $record): array
    {
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $login = Doc::parseDate($record['login_at'] ?? null);
        $end = Doc::parseDate($record['logout_at'] ?? null) ?? $now;
        $session = $login ? max(0, $end->getTimestamp() - $login->getTimestamp()) : 0;
        $breaks = 0;
        foreach ($record['breaks'] ?? [] as $item) {
            $start = Doc::parseDate($item['start_at'] ?? null);
            if ($start === null) {
                continue;
            }
            $breakEnd = Doc::parseDate($item['end_at'] ?? null) ?? $end;
            $breaks += max(0, $breakEnd->getTimestamp() - $start->getTimestamp());
        }
        return ['session_seconds' => $session, 'break_seconds' => $breaks, 'working_seconds' => max(0, $session - $breaks)];
    }
}
