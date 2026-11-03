<?php

declare(strict_types=1);

namespace YahooCrm\Controllers;

use YahooCrm\Catalog;
use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Guard;
use YahooCrm\Request;
use YahooCrm\Response;
use YahooCrm\Scope;

final class ActivityController
{
    private const TASKS = ['call', 'whatsapp', 'email', 'meeting', 'site_visit', 'other'];
    private const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    private const FOLLOW_STATUS = ['pending', 'completed', 'cancelled'];
    private const VISIT_STATUS = ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'];

    public function __construct(private readonly Database $db)
    {
    }

    public function createCall(Request $request): Response
    {
        $user = Guard::user($request);
        $outcome = (string) ($request->body['outcome'] ?? '');
        $leadId = $request->body['lead_id'] ?? null;
        if ($leadId === null || $leadId === '' || $outcome === '' || !in_array($outcome, Catalog::CALL_OUTCOMES, true)) {
            return Response::json(['success' => false, 'error' => 'Valid lead_id and call outcome are required.'], 400);
        }
        $dueAt = null;
        if (!empty($request->body['next_follow_up_at'])) {
            $dueAt = Doc::parseDate($request->body['next_follow_up_at']);
            if ($dueAt === null) {
                return Response::json(['success' => false, 'error' => 'Invalid follow-up date.'], 400);
            }
        }
        $lead = $this->writableLead($user, $leadId);
        if ($lead instanceof Response) {
            return $lead;
        }
        $now = Doc::date();
        $call = $this->db->insert(Collections::LEADCALLS, [
            'company_id' => Doc::oid($lead['company_id']),
            'lead_id' => $lead['_id'],
            'employee_id' => $user['_id'],
            'started_at' => $now,
            'ended_at' => $now,
            'duration_seconds' => 0,
            'gap_before_seconds' => 0,
            'outcome' => $outcome,
            'notes' => trim((string) ($request->body['notes'] ?? '')),
            'status' => 'completed',
        ]);
        if ($dueAt !== null) {
            $this->db->updateOne(Collections::LEADS, ['_id' => $lead['_id']], ['next_follow_up_at' => Doc::date($dueAt)]);
        }
        return Response::json([
            'success' => true,
            'message' => 'Call log saved successfully.',
            'data' => [
                'id' => (string) $call['_id'],
                'lead_id' => (string) $call['lead_id'],
                'employee_id' => (string) $call['employee_id'],
                'outcome' => $call['outcome'],
                'notes' => $call['notes'],
                'started_at' => Doc::iso($call['started_at']),
                'ended_at' => Doc::iso($call['ended_at']),
                'duration_seconds' => 0,
                'next_follow_up_at' => $dueAt ? Doc::iso($dueAt) : null,
            ],
        ], 201);
    }

    public function calls(Request $request): Response
    {
        $user = Guard::user($request);
        $calls = $this->db->find(Collections::LEADCALLS, Scope::activityFilter($this->db, $user), ['sort' => ['started_at' => -1], 'limit' => 500]);
        $calls = $this->db->populate($calls, 'lead_id', Collections::LEADS, ['full_name', 'mobile', 'lead_code']);
        $calls = $this->db->populate($calls, 'employee_id', Collections::USERS, ['full_name']);
        return Response::json(['success' => true, 'data' => array_map([$this, 'callRow'], $calls)]);
    }

    public function callAnalytics(Request $request): Response
    {
        Guard::user($request);
        $calls = $this->db->find(Collections::LEADCALLS, Scope::activityFilter($this->db, $request->user), ['projection' => ['outcome' => 1, 'employee_id' => 1]]);
        $calls = $this->db->populate($calls, 'employee_id', Collections::USERS, ['full_name']);
        $outcomes = [];
        $employees = [];
        foreach ($calls as $call) {
            $outcome = (string) ($call['outcome'] ?? 'other');
            $outcomes[$outcome] = ($outcomes[$outcome] ?? 0) + 1;
            $employee = is_array($call['employee_id'] ?? null) ? $call['employee_id'] : [];
            $id = Doc::idString($call['employee_id'] ?? null) ?? '';
            if (!isset($employees[$id])) {
                $employees[$id] = ['id' => $id, 'full_name' => $employee['full_name'] ?? 'Unknown', 'calls_logged' => 0];
            }
            $employees[$id]['calls_logged']++;
        }
        $byOutcome = [];
        foreach ($outcomes as $outcome => $count) {
            $byOutcome[] = ['outcome' => $outcome, 'cnt' => $count];
        }
        return Response::json([
            'success' => true,
            'data' => [
                'by_outcome' => $byOutcome,
                'by_employee' => array_values($employees),
                'note' => 'Logged outcomes are employee-reported. Call duration and connection are not verified by a telephony provider.',
            ],
        ]);
    }

    public function createFollowUp(Request $request): Response
    {
        $user = Guard::user($request);
        $body = $request->body;
        if (empty($body['lead_id']) || empty($body['title']) || empty($body['due_at'])) {
            return Response::json(['success' => false, 'error' => 'Lead, title and due date are required.'], 400);
        }
        $task = (string) ($body['task_type'] ?? '');
        $priority = (string) ($body['priority'] ?? '');
        if ($task !== '' && !in_array($task, self::TASKS, true)) {
            return Response::json(['success' => false, 'error' => 'Invalid follow-up task type.'], 400);
        }
        if ($priority !== '' && !in_array($priority, self::PRIORITIES, true)) {
            return Response::json(['success' => false, 'error' => 'Invalid follow-up priority.'], 400);
        }
        $due = Doc::parseDate($body['due_at']);
        if ($due === null) {
            return Response::json(['success' => false, 'error' => 'Invalid follow-up date.'], 400);
        }
        $lead = $this->writableLead($user, $body['lead_id']);
        if ($lead instanceof Response) {
            return $lead;
        }
        $follow = $this->db->insert(Collections::FOLLOWUPS, [
            'company_id' => Doc::oid($lead['company_id']),
            'lead_id' => $lead['_id'],
            'employee_id' => $user['_id'],
            'created_by' => $user['_id'],
            'title' => trim((string) $body['title']),
            'task_type' => $task !== '' ? $task : 'call',
            'priority' => $priority !== '' ? $priority : 'medium',
            'due_at' => Doc::date($due),
            'status' => 'pending',
            'notes' => trim((string) ($body['notes'] ?? '')),
            'completed_at' => null,
        ]);
        $this->db->updateOne(Collections::LEADS, ['_id' => $lead['_id']], ['next_follow_up_at' => Doc::date($due)]);
        return Response::json([
            'success' => true,
            'message' => 'Follow-up scheduled successfully.',
            'data' => Doc::jsonable($follow),
        ], 201);
    }

    public function followUps(Request $request): Response
    {
        $user = Guard::user($request);
        $filter = Scope::activityFilter($this->db, $user);
        $status = (string) ($request->query['status'] ?? '');
        if (in_array($status, self::FOLLOW_STATUS, true)) {
            $filter = Scope::combine($filter, ['status' => $status]);
        }
        $rows = $this->db->find(Collections::FOLLOWUPS, $filter, ['sort' => ['due_at' => 1], 'limit' => 500]);
        $rows = $this->db->populate($rows, 'lead_id', Collections::LEADS, ['full_name', 'mobile', 'lead_code']);
        $rows = $this->db->populate($rows, 'employee_id', Collections::USERS, ['full_name']);
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $out = [];
        foreach ($rows as $row) {
            $due = Doc::parseDate($row['due_at'] ?? null);
            $display = $row['status'] ?? 'pending';
            if ($display === 'pending' && $due !== null && $due < $now) {
                $display = 'overdue';
            }
            if ($status === 'overdue' && $display !== 'overdue') {
                continue;
            }
            if ($status === 'pending' && $display !== 'pending') {
                continue;
            }
            $lead = is_array($row['lead_id'] ?? null) ? $row['lead_id'] : [];
            $owner = is_array($row['employee_id'] ?? null) ? $row['employee_id'] : [];
            $out[] = [
                'id' => (string) $row['_id'],
                'due_at' => Doc::iso($row['due_at'] ?? null),
                'title' => $row['title'] ?? '',
                'lead_name' => $lead['full_name'] ?? '',
                'lead_id' => Doc::idString($row['lead_id'] ?? null),
                'owner_name' => $owner['full_name'] ?? '',
                'task_type' => $row['task_type'] ?? '',
                'priority' => $row['priority'] ?? '',
                'status' => $display,
                'notes' => $row['notes'] ?? '',
            ];
        }
        return Response::json(['success' => true, 'data' => $out]);
    }

    public function updateFollowUp(Request $request): Response
    {
        $user = Guard::user($request);
        $id = Doc::oid($request->params['id'] ?? null);
        if ($id === null) {
            return Response::json(['success' => false, 'error' => 'Invalid follow-up ID.'], 400);
        }
        $updates = [];
        foreach (['title', 'task_type', 'priority', 'due_at', 'status', 'notes'] as $field) {
            if (array_key_exists($field, $request->body)) {
                $updates[$field] = $request->body[$field];
            }
        }
        if ($updates === []) {
            return Response::json(['success' => false, 'error' => 'No valid fields provided for update.'], 400);
        }
        if (array_key_exists('title', $updates)) {
            $updates['title'] = trim((string) $updates['title']);
            if ($updates['title'] === '') {
                return Response::json(['success' => false, 'error' => 'Follow-up title cannot be empty.'], 400);
            }
        }
        if (array_key_exists('due_at', $updates)) {
            $due = Doc::parseDate($updates['due_at']);
            if ($due === null) {
                return Response::json(['success' => false, 'error' => 'Invalid due date.'], 400);
            }
            $updates['due_at'] = Doc::date($due);
        }
        if (array_key_exists('status', $updates) && !in_array($updates['status'], self::FOLLOW_STATUS, true)) {
            return Response::json(['success' => false, 'error' => 'Invalid follow-up status.'], 400);
        }
        if (($updates['status'] ?? null) === 'completed') {
            $updates['completed_at'] = Doc::date();
        } elseif (($updates['status'] ?? null) === 'pending') {
            $updates['completed_at'] = null;
        }
        $follow = $this->db->replaceFields(Collections::FOLLOWUPS, Scope::combine(Scope::activityFilter($this->db, $user), ['_id' => $id]), $updates);
        if ($follow === null) {
            return Response::json(['success' => false, 'error' => 'Follow-up not found.'], 404);
        }
        if (isset($updates['due_at'])) {
            $this->db->updateOne(Collections::LEADS, ['_id' => $follow['lead_id']], ['next_follow_up_at' => $updates['due_at']]);
        }
        return Response::json(['success' => true, 'message' => 'Follow-up updated successfully.', 'data' => Doc::jsonable($follow)]);
    }

    public function escalate(Request $request): Response
    {
        $user = Guard::role($request, ['admin', 'team_lead', 'super_admin']);
        $rows = $this->db->find(Collections::FOLLOWUPS, Scope::combine(Scope::activityFilter($this->db, $user), [
            'status' => 'pending',
            'due_at' => ['$lt' => Doc::date()],
        ]));
        foreach ($rows as $row) {
            $this->db->updateOne(Collections::FOLLOWUPS, ['_id' => $row['_id']], ['priority' => 'urgent']);
        }
        return Response::json(['success' => true, 'data' => ['escalated' => count($rows)]]);
    }

    public function createVisit(Request $request): Response
    {
        $user = Guard::user($request);
        if (empty($request->body['lead_id']) || empty($request->body['scheduled_at'])) {
            return Response::json(['success' => false, 'error' => 'Lead and visit date are required.'], 400);
        }
        $when = Doc::parseDate($request->body['scheduled_at']);
        if ($when === null) {
            return Response::json(['success' => false, 'error' => 'Invalid site visit date.'], 400);
        }
        $lead = $this->writableLead($user, $request->body['lead_id']);
        if ($lead instanceof Response) {
            return $lead;
        }
        $visit = $this->db->insert(Collections::SITEVISITS, [
            'company_id' => Doc::oid($lead['company_id']),
            'lead_id' => $lead['_id'],
            'employee_id' => $user['_id'],
            'created_by' => $user['_id'],
            'property_id' => $request->body['property_id'] ?? null,
            'property_name' => trim((string) ($request->body['property_name'] ?? '')),
            'scheduled_at' => Doc::date($when),
            'status' => 'scheduled',
            'notes' => trim((string) ($request->body['notes'] ?? '')),
            'feedback' => '',
            'completed_at' => null,
        ]);
        return Response::json(['success' => true, 'message' => 'Site visit scheduled successfully.', 'data' => Doc::jsonable($visit)], 201);
    }

    public function visits(Request $request): Response
    {
        $user = Guard::user($request);
        $rows = $this->db->find(Collections::SITEVISITS, Scope::activityFilter($this->db, $user), ['sort' => ['scheduled_at' => 1], 'limit' => 500]);
        $rows = $this->db->populate($rows, 'lead_id', Collections::LEADS, ['full_name', 'mobile', 'lead_code']);
        $rows = $this->db->populate($rows, 'employee_id', Collections::USERS, ['full_name']);
        $out = [];
        foreach ($rows as $row) {
            $lead = is_array($row['lead_id'] ?? null) ? $row['lead_id'] : [];
            $owner = is_array($row['employee_id'] ?? null) ? $row['employee_id'] : [];
            $out[] = [
                'id' => (string) $row['_id'],
                'scheduled_at' => Doc::iso($row['scheduled_at'] ?? null),
                'lead_name' => $lead['full_name'] ?? '',
                'lead_id' => Doc::idString($row['lead_id'] ?? null),
                'property_name' => $row['property_name'] ?? '',
                'owner_name' => $owner['full_name'] ?? '',
                'status' => $row['status'] ?? 'scheduled',
                'notes' => $row['notes'] ?? '',
                'feedback' => $row['feedback'] ?? '',
            ];
        }
        return Response::json(['success' => true, 'data' => $out]);
    }

    public function updateVisit(Request $request): Response
    {
        $user = Guard::user($request);
        $id = Doc::oid($request->params['id'] ?? null);
        if ($id === null) {
            return Response::json(['success' => false, 'error' => 'Invalid site visit ID.'], 400);
        }
        $updates = [];
        foreach (['scheduled_at', 'status', 'feedback', 'notes', 'property_name', 'property_id'] as $field) {
            if (array_key_exists($field, $request->body)) {
                $updates[$field] = $request->body[$field];
            }
        }
        if ($updates === []) {
            return Response::json(['success' => false, 'error' => 'No valid fields provided for update.'], 400);
        }
        if (array_key_exists('status', $updates) && !in_array($updates['status'], self::VISIT_STATUS, true)) {
            return Response::json(['success' => false, 'error' => 'Invalid site visit status.'], 400);
        }
        if (array_key_exists('scheduled_at', $updates)) {
            $when = Doc::parseDate($updates['scheduled_at']);
            if ($when === null) {
                return Response::json(['success' => false, 'error' => 'Invalid site visit date.'], 400);
            }
            $updates['scheduled_at'] = Doc::date($when);
        }
        foreach (['feedback', 'notes', 'property_name'] as $field) {
            if (array_key_exists($field, $updates)) {
                $updates[$field] = trim((string) ($updates[$field] ?? ''));
            }
        }
        if (($updates['status'] ?? null) === 'completed') {
            $updates['completed_at'] = Doc::date();
        } elseif (array_key_exists('status', $updates)) {
            $updates['completed_at'] = null;
        }
        $visit = $this->db->replaceFields(Collections::SITEVISITS, Scope::combine(Scope::activityFilter($this->db, $user), ['_id' => $id]), $updates);
        if ($visit === null) {
            return Response::json(['success' => false, 'error' => 'Site visit not found.'], 404);
        }
        return Response::json(['success' => true, 'message' => 'Site visit updated successfully.', 'data' => Doc::jsonable($visit)]);
    }

    private function writableLead(array $user, mixed $leadId): array|Response
    {
        if (($user['role'] ?? '') === 'super_admin') {
            return Response::json(['success' => false, 'error' => 'Super Admin has read-only access to leads.'], 403);
        }
        $oid = Doc::oid($leadId);
        if ($oid === null) {
            return Response::json(['success' => false, 'error' => 'Assigned lead not found.'], 404);
        }
        $filter = ['_id' => $oid];
        if (($user['role'] ?? '') === 'employee') {
            $company = Scope::companyId($user);
            if ($company === null) {
                return Response::json(['success' => false, 'error' => 'Assigned lead not found.'], 404);
            }
            $filter['company_id'] = $company;
            $filter['owner'] = $user['_id'];
        } else {
            $filter = Scope::combine(Scope::visibleLeadFilter($this->db, $user), $filter);
        }
        $lead = $this->db->findOne(Collections::LEADS, $filter);
        if ($lead === null) {
            return Response::json(['success' => false, 'error' => 'Assigned lead not found.'], 404);
        }
        return $lead;
    }

    private function callRow(array $call): array
    {
        $lead = is_array($call['lead_id'] ?? null) ? $call['lead_id'] : [];
        $employee = is_array($call['employee_id'] ?? null) ? $call['employee_id'] : [];
        return [
            'id' => (string) $call['_id'],
            '_id' => (string) $call['_id'],
            'initiated_at' => Doc::iso($call['started_at'] ?? null),
            'started_at' => Doc::iso($call['started_at'] ?? null),
            'lead_id' => Doc::idString($call['lead_id'] ?? null),
            'lead_name' => $lead['full_name'] ?? '',
            'mobile' => $lead['mobile'] ?? '',
            'lead_code' => $lead['lead_code'] ?? '',
            'employee_id' => Doc::idString($call['employee_id'] ?? null),
            'employee_name' => $employee['full_name'] ?? '',
            'outcome' => $call['outcome'] ?? '',
            'notes' => $call['notes'] ?? '',
            'duration_seconds' => $call['duration_seconds'] ?? 0,
            'status' => $call['status'] ?? '',
        ];
    }
}
