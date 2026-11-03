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

final class EmployeeController
{
    public function __construct(
        private readonly Database $db,
        private readonly AttendanceController $attendance,
    ) {
    }

    public function workspace(Request $request): Response
    {
        $user = Guard::role($request, ['employee']);
        $companyId = Scope::companyId($user);
        if ($companyId === null) {
            return Response::json(['success' => false, 'error' => 'Your account is not assigned to a valid company.'], 403);
        }
        $bounds = Clock::monthBounds(isset($request->query['month']) ? (string) $request->query['month'] : null);
        $dateStart = Doc::date(new \DateTimeImmutable($bounds['start'] . 'T00:00:00Z'));
        $dateEnd = Doc::date(new \DateTimeImmutable($bounds['end'] . 'T00:00:00Z'));

        $profile = $this->db->populateOne(
            $this->db->findOne(Collections::USERS, ['_id' => $user['_id']], [
                'projection' => ['full_name' => 1, 'employee_code' => 1, 'email' => 1, 'phone' => 1, 'role' => 1, 'company_id' => 1, 'team_id' => 1, 'timezone' => 1],
            ]),
            'company_id',
            Collections::COMPANIES,
            ['name', 'code'],
        );

        $leadsRaw = $this->db->find(Collections::LEADS, [
            'company_id' => $companyId,
            'owner' => $user['_id'],
        ], ['sort' => ['created_at' => -1], 'limit' => 500]);

        $callsRaw = $this->db->populate($this->db->find(Collections::LEADCALLS, [
            'company_id' => $companyId,
            'employee_id' => $user['_id'],
            'started_at' => ['$gte' => $dateStart, '$lt' => $dateEnd],
        ], ['sort' => ['started_at' => -1], 'limit' => 500]), 'lead_id', Collections::LEADS, ['full_name', 'mobile', 'lead_code']);

        $followRaw = $this->db->populate($this->db->find(Collections::FOLLOWUPS, [
            'company_id' => $companyId,
            'employee_id' => $user['_id'],
            'due_at' => ['$gte' => $dateStart, '$lt' => $dateEnd],
        ], ['sort' => ['due_at' => 1]]), 'lead_id', Collections::LEADS, ['full_name', 'mobile', 'lead_code']);

        $visitsRaw = $this->db->populate($this->db->find(Collections::SITEVISITS, [
            'company_id' => $companyId,
            'employee_id' => $user['_id'],
            'scheduled_at' => ['$gte' => $dateStart, '$lt' => $dateEnd],
        ], ['sort' => ['scheduled_at' => 1]]), 'lead_id', Collections::LEADS, ['full_name', 'mobile', 'lead_code']);

        $callCounts = [];
        $lastContacts = [];
        foreach ($callsRaw as $call) {
            $id = Doc::idString($call['lead_id'] ?? null) ?? '';
            $callCounts[$id] = ($callCounts[$id] ?? 0) + 1;
            $lastContacts[$id] ??= Doc::iso($call['started_at'] ?? null);
        }

        $leads = [];
        foreach ($leadsRaw as $lead) {
            $id = (string) $lead['_id'];
            $leads[] = [
                'id' => $id,
                'lead_code' => $lead['lead_code'] ?? '',
                'full_name' => $lead['full_name'] ?? '',
                'mobile' => $lead['mobile'] ?? '',
                'email' => $lead['email'] ?? '',
                'city' => $lead['city'] ?? '',
                'location' => $lead['location'] ?? '',
                'property_type' => $lead['property_type'] ?? '',
                'preferred_configuration' => $lead['preferred_configuration'] ?? '',
                'budget_min' => $lead['budget_min'] ?? null,
                'budget_max' => $lead['budget_max'] ?? null,
                'priority' => $lead['priority'] ?? 'medium',
                'status_id' => $lead['status_id'] ?? 1,
                'status_name' => Catalog::statusName($lead['status_id'] ?? 1),
                'call_count' => $callCounts[$id] ?? 0,
                'last_contact_at' => $lastContacts[$id] ?? null,
                'next_follow_up_at' => Doc::iso($lead['next_follow_up_at'] ?? null),
                'is_terminal' => (int) ($lead['status_id'] ?? 0) === 4,
            ];
        }

        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $followUps = [];
        foreach ($followRaw as $item) {
            $lead = is_array($item['lead_id'] ?? null) ? $item['lead_id'] : [];
            $due = Doc::parseDate($item['due_at'] ?? null);
            $status = $item['status'] ?? 'pending';
            if ($status !== 'completed' && $status !== 'cancelled' && $due !== null && $due < $now) {
                $status = 'overdue';
            }
            $followUps[] = [
                'id' => (string) $item['_id'],
                'title' => $item['title'] ?? '',
                'lead_name' => $lead['full_name'] ?? 'Unknown lead',
                'mobile' => $lead['mobile'] ?? '',
                'lead_id' => Doc::idString($item['lead_id'] ?? null),
                'due_at' => Doc::iso($item['due_at'] ?? null),
                'status' => $status,
                'task_type' => $item['task_type'] ?? 'call',
                'priority' => $item['priority'] ?? 'medium',
                'notes' => $item['notes'] ?? '',
            ];
        }

        $visits = [];
        foreach ($visitsRaw as $item) {
            $lead = is_array($item['lead_id'] ?? null) ? $item['lead_id'] : [];
            $visits[] = [
                'id' => (string) $item['_id'],
                'lead_id' => Doc::idString($item['lead_id'] ?? null),
                'lead_name' => $lead['full_name'] ?? 'Unknown lead',
                'mobile' => $lead['mobile'] ?? '',
                'scheduled_at' => Doc::iso($item['scheduled_at'] ?? null),
                'property_name' => $item['property_name'] ?? '',
                'status' => $item['status'] ?? 'scheduled',
            ];
        }

        $calls = [];
        $connectedOutcomes = array_values(array_diff(Catalog::CALL_OUTCOMES, Catalog::MISSED_OUTCOMES));
        $todayStart = new \DateTimeImmutable('today');
        $todayCalls = 0;
        $connectedToday = 0;
        $connectedCalls = 0;
        $daily = [];
        foreach ($callsRaw as $item) {
            $lead = is_array($item['lead_id'] ?? null) ? $item['lead_id'] : [];
            $started = Doc::parseDate($item['started_at'] ?? null);
            $connected = !in_array($item['outcome'] ?? '', Catalog::MISSED_OUTCOMES, true);
            if ($connected) {
                $connectedCalls++;
            }
            if ($started !== null && $started >= $todayStart) {
                $todayCalls++;
                if ($connected) {
                    $connectedToday++;
                }
            }
            $day = $started?->format('Y-m-d');
            if ($day !== null) {
                $daily[$day] ??= ['date' => $day, 'calls' => 0, 'connected' => 0];
                $daily[$day]['calls']++;
                if ($connected) {
                    $daily[$day]['connected']++;
                }
            }
            $calls[] = [
                'id' => (string) $item['_id'],
                'lead_id' => Doc::idString($item['lead_id'] ?? null),
                'lead_name' => $lead['full_name'] ?? 'Unknown lead',
                'mobile' => $lead['mobile'] ?? '',
                'outcome' => $item['outcome'] ?? 'other',
                'initiated_at' => Doc::iso($item['started_at'] ?? null),
                'notes' => $item['notes'] ?? '',
                'duration_seconds' => $item['duration_seconds'] ?? 0,
            ];
        }

        $calendar = $this->attendance->calendar($user, $bounds['value']);
        $statusCount = static function (int $id) use ($leads): int {
            return count(array_filter($leads, static fn (array $lead): bool => (int) $lead['status_id'] === $id));
        };
        $pending = array_values(array_filter($followUps, static fn (array $item): bool => $item['status'] === 'pending'));
        $overdue = array_values(array_filter($followUps, static fn (array $item): bool => $item['status'] === 'overdue'));
        $interested = $statusCount(2);
        $connectRate = count($callsRaw) ? round(($connectedCalls / count($callsRaw)) * 1000) / 10 : 0;

        $active = null;
        foreach ($calendar['records'] as $record) {
            if (($record['work_date'] ?? '') === Clock::workDate($now, $profile['timezone'] ?? 'Asia/Kolkata') && !empty($record['is_checked_in'])) {
                $active = $record;
            }
        }
        $recent = [];
        foreach ($calendar['records'] as $record) {
            foreach ($record['sessions'] ?? [] as $session) {
                $recent[] = [
                    'login_at' => $session['login_at'],
                    'logout_at' => $session['logout_at'],
                    'last_seen_at' => $session['logout_at'] ?? $session['login_at'],
                    'expires_at' => null,
                    'ip_address' => null,
                ];
            }
        }

        return Response::json([
            'success' => true,
            'data' => [
                'profile' => [
                    'full_name' => $profile['full_name'] ?? $user['full_name'],
                    'employee_code' => $profile['employee_code'] ?? '',
                    'department' => null,
                    'manager_name' => null,
                ],
                'session' => [
                    'is_checked_in' => $active !== null,
                    'login_at' => $active['login_at'] ?? null,
                    'logout_at' => null,
                    'recent' => $recent,
                ],
                'statuses' => Catalog::STATUSES,
                'properties' => [],
                'stats' => [
                    'assigned_leads' => count($leads),
                    'open_leads' => count(array_filter($leads, static fn (array $lead): bool => !$lead['is_terminal'])),
                    'new_leads' => $statusCount(1),
                    'calls_today' => $todayCalls,
                    'connected_today' => $connectedToday,
                    'follow_ups_today' => count($pending),
                    'overdue_follow_ups' => count($overdue),
                    'interested' => $interested,
                    'converted' => 0,
                    'pending' => count($pending),
                    'site_visits_upcoming' => count(array_filter($visits, static fn (array $visit): bool => $visit['status'] === 'scheduled')),
                ],
                'leads' => $leads,
                'calls' => $calls,
                'follow_ups' => $followUps,
                'site_visits' => $visits,
                'attendance' => $calendar,
                'performance' => [
                    'summary' => [
                        'conversion_rate' => 0,
                        'total_calls' => count($callsRaw),
                        'connected_calls' => $connectedCalls,
                        'calls_this_month' => count($callsRaw),
                        'connect_rate' => $connectRate,
                    ],
                    'daily' => array_values($daily),
                ],
            ],
        ]);
    }

    public function attendance(Request $request): Response
    {
        $user = Guard::role($request, ['employee']);
        $month = isset($request->query['month']) ? (string) $request->query['month'] : null;
        return Response::json([
            'success' => true,
            'data' => $this->attendance->calendar($user, Clock::monthBounds($month)['value']),
        ]);
    }
}
