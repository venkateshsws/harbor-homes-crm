<?php

declare(strict_types=1);

namespace YahooCrm\Controllers;

use YahooCrm\Clock;
use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Guard;
use YahooCrm\Request;
use YahooCrm\Response;
use MongoDB\BSON\ObjectId;
use Throwable;

final class AttendanceController
{
    public function __construct(private readonly Database $db)
    {
    }

    public function checkIn(Request $request): Response
    {
        $user = Guard::user($request);
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $timezone = $user['timezone'] ?? 'Asia/Kolkata';
        $workDate = Clock::workDate($now, $timezone);
        $record = $this->today($user, $workDate);
        if ($record !== null) {
            $sessions = $this->sessions($record);
            foreach ($sessions as $session) {
                if (empty($session['logout_at'])) {
                    return Response::json(['success' => false, 'error' => 'You are already checked in.'], 409);
                }
            }
            $sessions[] = [
                '_id' => new ObjectId(),
                'login_at' => Doc::date($now),
                'logout_at' => null,
                'breaks' => [],
            ];
            $this->db->updateOne(Collections::ATTENDANCES, ['_id' => $record['_id']], [
                'sessions' => $sessions,
                'logout_at' => null,
                'status' => 'present',
            ]);
            $record = $this->today($user, $workDate);
            return Response::json(['success' => true, 'data' => $this->serialize($record)]);
        }

        try {
            $created = $this->db->insert(Collections::ATTENDANCES, [
                'user' => $user['_id'],
                'company_id' => Doc::oid($user['company_id'] ?? null),
                'employee_code' => $user['employee_code'] ?? '',
                'full_name' => $user['full_name'] ?? '',
                'work_date' => $workDate,
                'timezone' => $timezone,
                'login_at' => Doc::date($now),
                'logout_at' => null,
                'sessions' => [[
                    '_id' => new ObjectId(),
                    'login_at' => Doc::date($now),
                    'logout_at' => null,
                    'breaks' => [],
                ]],
                'breaks' => [],
                'status' => 'present',
            ]);
        } catch (Throwable $error) {
            if (Doc::duplicate($error)) {
                return Response::json(['success' => false, 'error' => 'Attendance is already being recorded. Please refresh.'], 409);
            }
            throw $error;
        }
        return Response::json(['success' => true, 'data' => $this->serialize($created)], 201);
    }

    public function checkOut(Request $request): Response
    {
        $user = Guard::user($request);
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $record = $this->today($user, Clock::workDate($now, $user['timezone'] ?? 'Asia/Kolkata'));
        if ($record === null) {
            return Response::json(['success' => false, 'error' => 'Check in before checking out.'], 409);
        }
        $sessions = $this->sessions($record);
        $found = false;
        foreach ($sessions as &$session) {
            if (empty($session['logout_at'])) {
                foreach ($session['breaks'] ?? [] as &$break) {
                    if (empty($break['end_at'])) {
                        $break['end_at'] = Doc::date($now);
                    }
                }
                unset($break);
                $session['logout_at'] = Doc::date($now);
                $found = true;
            }
        }
        unset($session);
        if (!$found) {
            return Response::json(['success' => false, 'error' => 'No active check-in found. Please check in first.'], 409);
        }
        $this->db->updateOne(Collections::ATTENDANCES, ['_id' => $record['_id']], [
            'sessions' => $sessions,
            'logout_at' => Doc::date($now),
            'status' => 'checked_out',
        ]);
        return Response::json(['success' => true, 'data' => $this->serialize($this->db->findOne(Collections::ATTENDANCES, ['_id' => $record['_id']]))]);
    }

    public function todayView(Request $request): Response
    {
        $user = Guard::user($request);
        $record = $this->today($user, Clock::workDate(new \DateTimeImmutable('now', new \DateTimeZone('UTC')), $user['timezone'] ?? 'Asia/Kolkata'));
        return Response::json(['success' => true, 'data' => $record ? $this->serialize($record) : null]);
    }

    public function startBreak(Request $request): Response
    {
        return $this->mutateBreak($request, true);
    }

    public function endBreak(Request $request): Response
    {
        return $this->mutateBreak($request, false);
    }

    public function index(Request $request): Response
    {
        $user = Guard::user($request);
        $records = $this->db->find(Collections::ATTENDANCES, $this->accessFilter($user), [
            'sort' => ['work_date' => -1, 'login_at' => -1],
            'limit' => 500,
        ]);
        $data = [];
        foreach ($records as $record) {
            if ($this->canRead($user, $record)) {
                $data[] = $this->serialize($record);
            }
        }
        return Response::json(['success' => true, 'data' => $data]);
    }

    public function summary(Request $request): Response
    {
        $user = Guard::user($request);
        $records = $this->db->find(Collections::ATTENDANCES, $this->accessFilter($user), [
            'sort' => ['work_date' => -1],
            'limit' => 500,
        ]);
        $grouped = [];
        foreach ($records as $record) {
            if (!$this->canRead($user, $record)) {
                continue;
            }
            $id = (string) $record['user'];
            if (!isset($grouped[$id])) {
                $grouped[$id] = [
                    'id' => $id,
                    'full_name' => $record['full_name'] ?? '',
                    'present_days' => 0,
                    'total_working_seconds' => 0,
                    'total_session_seconds' => 0,
                    'total_break_seconds' => 0,
                    'late_count' => 0,
                    'missing_logout_count' => 0,
                ];
            }
            $time = $this->durations($record);
            $grouped[$id]['present_days']++;
            $grouped[$id]['total_working_seconds'] += $time['working_seconds'];
            $grouped[$id]['total_session_seconds'] += $time['session_seconds'];
            $grouped[$id]['total_break_seconds'] += $time['break_seconds'];
            foreach ($this->sessions($record) as $session) {
                if (empty($session['logout_at'])) {
                    $grouped[$id]['missing_logout_count']++;
                    break;
                }
            }
        }
        return Response::json([
            'success' => true,
            'data' => [
                'employees' => array_values($grouped),
                'note' => 'Working duration excludes recorded breaks. It measures session time, not verified productive time.',
            ],
        ]);
    }

    public function calendar(array $user, string $month): array
    {
        $bounds = Clock::monthBounds($month);
        $records = $this->db->find(Collections::ATTENDANCES, [
            'user' => $user['_id'],
            'work_date' => ['$gte' => $bounds['start'], '$lt' => $bounds['end']],
        ]);
        $byDate = [];
        foreach ($records as $record) {
            $byDate[$record['work_date']] = $record;
        }
        $today = Clock::workDate(new \DateTimeImmutable('now', new \DateTimeZone('UTC')), $user['timezone'] ?? 'Asia/Kolkata');
        $daysInMonth = (int) (new \DateTimeImmutable($bounds['end'] . 'T00:00:00Z'))->modify('-1 day')->format('d');
        $days = [];
        $summary = [
            'working_days' => 0,
            'present' => 0,
            'absent' => 0,
            'leave' => 0,
            'late' => 0,
            'early_logout' => 0,
            'missing_logout' => 0,
            'holidays' => 0,
            'working_seconds' => 0,
            'break_seconds' => 0,
            'session_seconds' => 0,
        ];
        for ($day = 1; $day <= $daysInMonth; $day++) {
            $date = sprintf('%s-%02d', $bounds['value'], $day);
            $weekday = (int) (new \DateTimeImmutable($date . 'T00:00:00Z'))->format('w');
            $record = $byDate[$date] ?? null;
            $login = null;
            $logout = null;
            $working = 0;
            $breaks = 0;
            if ($date > $today) {
                $status = 'upcoming';
            } elseif ($record !== null) {
                $time = $this->durations($record);
                $sessions = $this->sessions($record);
                $active = false;
                foreach ($sessions as $session) {
                    if (empty($session['logout_at'])) {
                        $active = true;
                    }
                }
                $status = $active ? 'in_progress' : 'present';
                $first = $sessions[0] ?? $record;
                $last = $sessions[count($sessions) - 1] ?? $record;
                $login = Doc::iso($first['login_at'] ?? $record['login_at'] ?? null);
                $logout = $active ? null : Doc::iso($last['logout_at'] ?? $record['logout_at'] ?? null);
                $working = $time['working_seconds'];
                $breaks = $time['break_seconds'];
                if ($active) {
                    $summary['missing_logout']++;
                }
            } elseif ($weekday === 0) {
                $status = 'holiday';
            } else {
                $status = 'not_logged_in';
            }
            if ($date <= $today && $weekday !== 0) {
                $summary['working_days']++;
            }
            if ($login) {
                $summary['present']++;
                $summary['working_seconds'] += $working;
                $summary['break_seconds'] += $breaks;
                $summary['session_seconds'] += $working + $breaks;
            } elseif ($status === 'not_logged_in') {
                $summary['absent']++;
            } elseif ($status === 'holiday' && $date <= $today) {
                $summary['holidays']++;
            }
            $days[] = [
                'date' => $date,
                'weekday' => $weekday,
                'status' => $status,
                'login_at' => $login,
                'logout_at' => $logout,
                'working_seconds' => $working,
                'break_seconds' => $breaks,
                'is_late' => false,
                'is_early_logout' => false,
            ];
        }
        $summary['avg_working_seconds'] = (int) round($summary['working_seconds'] / max(1, $summary['present']));
        $summary['attendance_rate'] = $summary['working_days']
            ? round((1000 * ($summary['present'] + $summary['leave'])) / $summary['working_days']) / 10
            : 0;
        return [
            'month' => $bounds['value'],
            'from' => $bounds['start'],
            'to' => sprintf('%s-%02d', $bounds['value'], $daysInMonth),
            'days' => $days,
            'summary' => $summary,
            'records' => array_map([$this, 'serialize'], array_values($byDate)),
            'note' => 'Working duration excludes recorded breaks. Days without a check-in are not treated as approved leave.',
        ];
    }

    private function mutateBreak(Request $request, bool $start): Response
    {
        $user = Guard::user($request);
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $record = $this->today($user, Clock::workDate($now, $user['timezone'] ?? 'Asia/Kolkata'));
        if ($record === null) {
            return Response::json(['success' => false, 'error' => $start ? 'Check in before starting a break.' : 'No active attendance session was found.'], 409);
        }
        $sessions = $this->sessions($record);
        $active = null;
        foreach ($sessions as $index => $session) {
            if (empty($session['logout_at'])) {
                $active = $index;
                break;
            }
        }
        if ($active === null) {
            return Response::json(['success' => false, 'error' => $start ? 'Check in before starting a break.' : 'No active attendance session was found.'], 409);
        }
        $breaks = $sessions[$active]['breaks'] ?? [];
        $open = null;
        foreach ($breaks as $index => $break) {
            if (empty($break['end_at'])) {
                $open = $index;
                break;
            }
        }
        if ($start) {
            if ($open !== null) {
                return Response::json(['success' => false, 'error' => 'A break is already in progress.'], 409);
            }
            $breaks[] = ['_id' => new ObjectId(), 'start_at' => Doc::date($now), 'end_at' => null];
        } else {
            if ($open === null) {
                return Response::json(['success' => false, 'error' => 'There is no active break.'], 409);
            }
            $breaks[$open]['end_at'] = Doc::date($now);
        }
        $sessions[$active]['breaks'] = $breaks;
        $this->db->updateOne(Collections::ATTENDANCES, ['_id' => $record['_id']], ['sessions' => $sessions]);
        return Response::json(['success' => true, 'data' => $this->serialize($this->db->findOne(Collections::ATTENDANCES, ['_id' => $record['_id']]))]);
    }

    private function today(array $user, string $workDate): ?array
    {
        return $this->db->findOne(Collections::ATTENDANCES, [
            'user' => $user['_id'],
            'work_date' => $workDate,
        ]);
    }

    private function sessions(array $record): array
    {
        if (!empty($record['sessions']) && is_array($record['sessions'])) {
            return $record['sessions'];
        }
        return [[
            'login_at' => $record['login_at'] ?? null,
            'logout_at' => $record['logout_at'] ?? null,
            'breaks' => $record['breaks'] ?? [],
        ]];
    }

    private function durations(array $record, ?\DateTimeImmutable $now = null): array
    {
        $now ??= new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $sessionSeconds = 0;
        $breakSeconds = 0;
        foreach ($this->sessions($record) as $session) {
            $start = Doc::parseDate($session['login_at'] ?? null);
            if ($start === null) {
                continue;
            }
            $end = Doc::parseDate($session['logout_at'] ?? null) ?? $now;
            $sessionSeconds += max(0, $end->getTimestamp() - $start->getTimestamp());
            foreach ($session['breaks'] ?? [] as $break) {
                $breakStart = Doc::parseDate($break['start_at'] ?? null);
                if ($breakStart === null) {
                    continue;
                }
                $breakEnd = Doc::parseDate($break['end_at'] ?? null) ?? $end;
                $breakSeconds += max(0, $breakEnd->getTimestamp() - $breakStart->getTimestamp());
            }
        }
        return [
            'session_seconds' => $sessionSeconds,
            'break_seconds' => $breakSeconds,
            'working_seconds' => max(0, $sessionSeconds - $breakSeconds),
        ];
    }

    private function serialize(array $record): array
    {
        $sessions = $this->sessions($record);
        $active = null;
        foreach ($sessions as $session) {
            if (empty($session['logout_at'])) {
                $active = $session;
                break;
            }
        }
        $latest = $sessions[count($sessions) - 1] ?? [];
        $first = $sessions[0] ?? [];
        $time = $this->durations($record);
        return [
            'id' => (string) $record['_id'],
            'employee_id' => (string) $record['user'],
            'employee_code' => $record['employee_code'] ?? '',
            'full_name' => $record['full_name'] ?? '',
            'work_date' => $record['work_date'] ?? '',
            'login_at' => Doc::iso($first['login_at'] ?? $record['login_at'] ?? null),
            'logout_at' => $active ? null : Doc::iso($latest['logout_at'] ?? $record['logout_at'] ?? null),
            'sessions' => array_map(static fn (array $session): array => [
                'id' => isset($session['_id']) ? (string) $session['_id'] : null,
                'login_at' => Doc::iso($session['login_at'] ?? null),
                'logout_at' => Doc::iso($session['logout_at'] ?? null),
            ], $sessions),
            'is_checked_in' => $active !== null,
            'working_seconds' => $time['working_seconds'],
            'session_seconds' => $time['session_seconds'],
            'break_seconds' => $time['break_seconds'],
            'is_late' => false,
            'status' => $active ? 'present' : 'checked_out',
        ];
    }

    private function accessFilter(array $user): array
    {
        if (($user['role'] ?? '') === 'super_admin') {
            return [];
        }
        $companyId = Doc::oid($user['company_id'] ?? null);
        if (($user['role'] ?? '') === 'admin' && $companyId) {
            return ['company_id' => $companyId];
        }
        if (($user['role'] ?? '') === 'team_lead' && $companyId) {
            return [
                'company_id' => $companyId,
                'user' => ['$in' => $this->teamUserIds($user)],
            ];
        }
        return ['user' => $user['_id']];
    }

    private function canRead(array $user, array $record): bool
    {
        if (($user['role'] ?? '') === 'super_admin') {
            return true;
        }
        if ((string) ($record['user'] ?? '') === (string) $user['_id']) {
            return true;
        }
        if (Doc::idString($record['company_id'] ?? null) !== Doc::idString($user['company_id'] ?? null)) {
            return false;
        }
        if (($user['role'] ?? '') === 'admin') {
            return true;
        }
        if (($user['role'] ?? '') === 'team_lead') {
            $allowed = array_map('strval', $this->teamUserIds($user));
            return in_array((string) ($record['user'] ?? ''), $allowed, true);
        }
        return false;
    }

    /** @return list<\MongoDB\BSON\ObjectId> */
    private function teamUserIds(array $user): array
    {
        $ids = [$user['_id']];
        $teamId = Doc::oid($user['team_id'] ?? null);
        $companyId = Doc::oid($user['company_id'] ?? null);
        if ($teamId === null || $companyId === null) {
            return $ids;
        }
        $members = $this->db->find(Collections::USERS, [
            'company_id' => $companyId,
            'team_id' => $teamId,
            'role' => 'employee',
        ], ['projection' => ['_id' => 1]]);
        foreach ($members as $member) {
            $ids[] = $member['_id'];
        }
        return $ids;
    }
}
