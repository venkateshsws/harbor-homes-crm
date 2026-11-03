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
use Throwable;

final class LeadController
{
    public function __construct(private readonly Database $db)
    {
    }

    public function meta(Request $request): Response
    {
        Guard::user($request);
        return Response::json([
            'success' => true,
            'data' => [
                'statuses' => Catalog::STATUSES,
                'sources' => Catalog::SOURCES,
            ],
        ]);
    }

    public function index(Request $request): Response
    {
        $user = Guard::user($request);
        if (($request->query['unassigned'] ?? '') === '1') {
            if (!Scope::canAssign($user)) {
                return Response::json(['success' => false, 'error' => 'Only Admins and Team Leads can view the assignment queue.'], 403);
            }
            $filter = Scope::combine(Scope::companyFilter($user), [
                '$or' => [
                    ['owner' => null],
                    ['owner' => ['$exists' => false]],
                ],
            ]);
        } else {
            $filter = Scope::visibleLeadFilter($this->db, $user);
        }

        if (isset($request->query['status_id']) && $request->query['status_id'] !== '') {
            $statusId = (int) $request->query['status_id'];
            if (!Catalog::validStatus($statusId)) {
                return Response::json(['success' => false, 'error' => 'Invalid lead status.'], 400);
            }
            $filter = Scope::combine($filter, ['status_id' => $statusId]);
        }
        if (isset($request->query['priority']) && $request->query['priority'] !== '') {
            if (!array_key_exists((string) $request->query['priority'], Catalog::PRIORITY)) {
                return Response::json(['success' => false, 'error' => 'Invalid lead priority.'], 400);
            }
            $filter = Scope::combine($filter, ['priority' => (string) $request->query['priority']]);
        }
        if (isset($request->query['q']) && trim((string) $request->query['q']) !== '') {
            $search = substr(trim((string) $request->query['q']), 0, 100);
            $regex = Doc::regex(Doc::escapeRegex($search), 'i');
            $filter = Scope::combine($filter, [
                '$or' => [
                    ['full_name' => $regex],
                    ['mobile' => $regex],
                    ['lead_code' => $regex],
                    ['city' => $regex],
                ],
            ]);
        }

        $leads = $this->withRelations($this->db->find(Collections::LEADS, $filter, [
            'sort' => ['created_at' => -1],
            'limit' => 500,
        ]));
        $total = $this->db->count(Collections::LEADS, $filter);

        if (($request->query['unassigned'] ?? '') === '1' && ($request->query['sort'] ?? '') === 'priority') {
            usort($leads, static function (array $a, array $b): int {
                $rank = (Catalog::PRIORITY[$a['priority'] ?? ''] ?? 99) <=> (Catalog::PRIORITY[$b['priority'] ?? ''] ?? 99);
                if ($rank !== 0) {
                    return $rank;
                }
                return strcmp(Doc::iso($b['created_at'] ?? null) ?? '', Doc::iso($a['created_at'] ?? null) ?? '');
            });
        }

        return Response::json([
            'success' => true,
            'data' => array_map([$this, 'serialize'], $leads),
            'meta' => ['total' => $total],
        ]);
    }

    public function show(Request $request): Response
    {
        $user = Guard::user($request);
        $lead = $this->visibleLead($user, $request->params['id'] ?? null);
        if ($lead instanceof Response) {
            return $lead;
        }
        $lead = $this->withRelations([$lead])[0];
        $notes = $this->db->find(Collections::LEADNOTES, [
            'lead_id' => $lead['_id'],
            'company_id' => $lead['company_id'] instanceof ObjectId || is_array($lead['company_id'])
                ? (Doc::oid($lead['company_id']) ?? $lead['company_id'])
                : $lead['company_id'],
        ], ['sort' => ['created_at' => -1]]);
        $assignments = $this->db->find(Collections::LEADASSIGNMENTS, ['lead_id' => $lead['_id']], ['sort' => ['created_at' => -1]]);
        $calls = $this->db->find(Collections::LEADCALLS, ['lead_id' => $lead['_id']], ['sort' => ['started_at' => -1], 'limit' => 200]);
        $calls = $this->db->populate($calls, 'employee_id', Collections::USERS, ['full_name']);

        if ($assignments === [] && Doc::idString($lead['owner'] ?? null) !== null) {
            $owner = is_array($lead['owner']) ? $lead['owner'] : [];
            $assignments[] = [
                '_id' => 'current',
                'from_name' => null,
                'to_name' => $owner['full_name'] ?? 'Assigned',
                'method' => 'assigned',
                'created_at' => $lead['updated_at'] ?? $lead['created_at'] ?? null,
            ];
        }

        $serialized = $this->serialize($lead);
        $serialized['source_name'] = Catalog::sourceName($lead['source_id'] ?? 1);

        return Response::json([
            'success' => true,
            'data' => [
                'lead' => $serialized,
                'notes' => array_map(static fn (array $note): array => [
                    'id' => (string) $note['_id'],
                    'author_name' => $note['author_name'] ?? '',
                    'note' => $note['note'] ?? '',
                    'created_at' => Doc::iso($note['created_at'] ?? null),
                ], $notes),
                'assignments' => array_map(static fn (array $item): array => [
                    'id' => (string) $item['_id'],
                    'from_name' => $item['from_name'] ?? null,
                    'to_name' => $item['to_name'] ?? '',
                    'method' => $item['method'] ?? '',
                    'created_at' => Doc::iso($item['created_at'] ?? null),
                ], $assignments),
                'calls' => array_map(static function (array $call): array {
                    $employee = is_array($call['employee_id'] ?? null) ? $call['employee_id'] : [];
                    return [
                        'id' => (string) $call['_id'],
                        'outcome' => $call['outcome'] ?? '',
                        'employee_name' => $employee['full_name'] ?? '',
                        'notes' => $call['notes'] ?? '',
                        'initiated_at' => Doc::iso($call['started_at'] ?? null),
                    ];
                }, $calls),
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        $user = Guard::user($request);
        if (($user['role'] ?? '') === 'super_admin') {
            return Response::json(['success' => false, 'error' => 'Super Admin has read-only access to leads.'], 403);
        }
        $lead = $this->createLead($request->body, $user);
        return Response::json(['success' => true, 'data' => $this->serialize($this->withRelations([$lead])[0])], 201);
    }

    public function update(Request $request): Response
    {
        $user = Guard::user($request);
        if (($user['role'] ?? '') === 'super_admin') {
            return Response::json(['success' => false, 'error' => 'Super Admin has read-only access to leads.'], 403);
        }
        $lead = $this->visibleLead($user, $request->params['id'] ?? null);
        if ($lead instanceof Response) {
            return $lead;
        }
        $updates = [];
        if (array_key_exists('status_id', $request->body)) {
            $statusId = (int) $request->body['status_id'];
            if (!Catalog::validStatus($statusId)) {
                return Response::json(['success' => false, 'error' => 'Invalid lead status.'], 400);
            }
            $updates['status_id'] = $statusId;
        }
        if (array_key_exists('requirements', $request->body)) {
            $updates['requirements'] = trim((string) $request->body['requirements']);
        }
        if (array_key_exists('priority', $request->body) && array_key_exists((string) $request->body['priority'], Catalog::PRIORITY)) {
            $updates['priority'] = (string) $request->body['priority'];
        }
        if ($updates === []) {
            return Response::json(['success' => false, 'error' => 'No valid fields provided for update.'], 400);
        }
        $this->db->updateOne(Collections::LEADS, ['_id' => $lead['_id']], $updates);
        $fresh = $this->db->findOne(Collections::LEADS, ['_id' => $lead['_id']]);
        return Response::json(['success' => true, 'data' => $this->serialize($this->withRelations([$fresh])[0])]);
    }

    public function addNote(Request $request): Response
    {
        $user = Guard::user($request);
        $lead = $this->visibleLead($user, $request->params['id'] ?? null);
        if ($lead instanceof Response) {
            return $lead;
        }
        $note = trim((string) ($request->body['note'] ?? ''));
        if ($note === '') {
            return Response::json(['success' => false, 'error' => 'Enter a note.'], 400);
        }
        $saved = $this->db->insert(Collections::LEADNOTES, [
            'company_id' => Doc::oid($lead['company_id']) ?? $lead['company_id'],
            'lead_id' => $lead['_id'],
            'author_id' => $user['_id'],
            'author_name' => $user['full_name'] ?? '',
            'note' => $note,
        ]);
        return Response::json([
            'success' => true,
            'data' => [
                'id' => (string) $saved['_id'],
                'author_name' => $saved['author_name'],
                'note' => $saved['note'],
                'created_at' => Doc::iso($saved['created_at'] ?? null),
            ],
        ], 201);
    }

    public function assign(Request $request): Response
    {
        $user = Guard::user($request);
        if (!Scope::canAssign($user)) {
            return Response::json(['success' => false, 'error' => 'Only Admins and Team Leads can assign leads.'], 403);
        }
        $leadId = Doc::oid($request->params['id'] ?? null);
        if ($leadId === null) {
            return Response::json(['success' => false, 'error' => 'Invalid lead ID.'], 400);
        }
        $method = (string) ($request->body['method'] ?? 'round_robin');
        if ($method === 'auto') {
            $method = 'round_robin';
        }
        $allowed = ['manual', 'round_robin', 'weighted_round_robin', 'workload', 'priority'];
        if (!in_array($method, $allowed, true)) {
            return Response::json(['success' => false, 'error' => 'Invalid assignment method.'], 400);
        }
        $employeeId = $request->body['employee_id'] ?? $request->body['to_user_id'] ?? null;
        $company = Scope::companyFilter($user);
        $lead = $this->db->findOne(Collections::LEADS, Scope::combine($company, ['_id' => $leadId]));
        if ($lead === null) {
            return Response::json(['success' => false, 'error' => 'Lead not found in your company.'], 404);
        }
        if (!empty($lead['owner'])) {
            return Response::json(['success' => false, 'error' => 'This lead has already been assigned. Refresh the queue.'], 409);
        }

        $employeeFilter = [
            'company_id' => Scope::companyId($user),
            'role' => 'employee',
            'is_active' => true,
            'is_assignment_eligible' => true,
        ];
        if (($user['role'] ?? '') === 'team_lead') {
            $teamId = Scope::teamId($user);
            if ($teamId === null) {
                return Response::json(['success' => false, 'error' => 'Your account is not assigned to a team.'], 400);
            }
            $employeeFilter['team_id'] = $teamId;
        }
        $employees = $this->db->find(Collections::USERS, $employeeFilter, [
            'projection' => ['_id' => 1, 'full_name' => 1, 'team_id' => 1, 'assignment_weight' => 1, 'max_open_leads' => 1],
            'sort' => ['_id' => 1],
        ]);
        if ($employees === []) {
            return Response::json(['success' => false, 'error' => 'No eligible employees found in your company/team.'], 400);
        }

        $workload = [];
        foreach ($employees as $employee) {
            $workload[] = [
                'employee' => $employee,
                'count' => $this->db->count(Collections::LEADS, [
                    'company_id' => Scope::companyId($user),
                    'owner' => $employee['_id'],
                ]),
            ];
        }
        $available = array_values(array_filter($workload, static function (array $row): bool {
            $limit = is_numeric($row['employee']['max_open_leads'] ?? null) ? (int) $row['employee']['max_open_leads'] : 50;
            return $row['count'] < $limit;
        }));
        if ($available === []) {
            return Response::json(['success' => false, 'error' => 'All eligible employees have reached their lead limits.'], 400);
        }

        $chosen = null;
        if ($method === 'manual') {
            $selectedId = Doc::oid($employeeId);
            if ($selectedId === null) {
                return Response::json(['success' => false, 'error' => 'Select a valid employee for manual assignment.'], 400);
            }
            foreach ($available as $row) {
                if ((string) $row['employee']['_id'] === (string) $selectedId) {
                    $chosen = $row['employee'];
                    break;
                }
            }
            if ($chosen === null) {
                return Response::json(['success' => false, 'error' => 'Selected employee is inactive, ineligible, outside your company/team, or at their lead limit.'], 400);
            }
        } elseif ($method === 'round_robin' || $method === 'weighted_round_robin') {
            $ring = $available;
            if ($method === 'weighted_round_robin') {
                $ring = [];
                foreach ($available as $row) {
                    $weight = max(1, min(100, (int) round((float) ($row['employee']['assignment_weight'] ?? 1))));
                    for ($i = 0; $i < $weight; $i++) {
                        $ring[] = $row;
                    }
                }
            }
            $owners = array_map(static fn (array $row) => $row['employee']['_id'], $available);
            $last = $this->db->findOne(Collections::LEADS, [
                'company_id' => Scope::companyId($user),
                'owner' => ['$in' => $owners],
            ], ['sort' => ['updated_at' => -1, 'created_at' => -1], 'projection' => ['owner' => 1]]);
            $lastId = Doc::idString($last['owner'] ?? null);
            $lastIndex = -1;
            foreach ($ring as $index => $row) {
                if ((string) $row['employee']['_id'] === $lastId) {
                    $lastIndex = $index;
                }
            }
            $next = $lastIndex >= 0 ? ($lastIndex + 1) % count($ring) : 0;
            $chosen = $ring[$next]['employee'];
        } elseif ($method === 'workload') {
            usort($available, static fn (array $a, array $b): int => $a['count'] <=> $b['count'] ?: strcmp((string) $a['employee']['_id'], (string) $b['employee']['_id']));
            $chosen = $available[0]['employee'];
        } else {
            $urgent = in_array($lead['priority'] ?? '', ['urgent', 'high'], true);
            usort($available, static function (array $a, array $b) use ($urgent): int {
                if ($urgent) {
                    $weight = ((float) ($b['employee']['assignment_weight'] ?? 1)) <=> ((float) ($a['employee']['assignment_weight'] ?? 1));
                    if ($weight !== 0) {
                        return $weight;
                    }
                }
                return $a['count'] <=> $b['count'] ?: strcmp((string) $a['employee']['_id'], (string) $b['employee']['_id']);
            });
            $chosen = $available[0]['employee'];
        }

        $updated = $this->db->replaceFields(Collections::LEADS, Scope::combine($company, [
            '_id' => $lead['_id'],
            '$or' => [
                ['owner' => null],
                ['owner' => ['$exists' => false]],
            ],
        ]), ['owner' => $chosen['_id']]);
        if ($updated === null) {
            return Response::json(['success' => false, 'error' => 'This lead has already been assigned. Refresh the queue.'], 409);
        }

        $this->db->insert(Collections::LEADASSIGNMENTS, [
            'company_id' => Scope::companyId($user),
            'lead_id' => $lead['_id'],
            'from_user' => null,
            'from_name' => null,
            'to_user' => $chosen['_id'],
            'to_name' => $chosen['full_name'] ?? '',
            'method' => $method,
            'created_by' => $user['_id'],
        ]);

        return Response::json([
            'success' => true,
            'message' => 'Lead assigned successfully.',
            'data' => $this->serialize($this->withRelations([$updated])[0]),
        ]);
    }

    public function import(Request $request): Response
    {
        $user = Guard::user($request);
        if (!in_array($user['role'] ?? '', ['admin', 'team_lead'], true)) {
            return Response::json(['success' => false, 'error' => 'Only Admins and Team Leads can import leads.'], 403);
        }
        $records = $request->body['records'] ?? null;
        if (!is_array($records) || $records === []) {
            return Response::json(['success' => false, 'error' => 'Provide a non-empty records array.'], 400);
        }
        if (count($records) > 1000) {
            return Response::json(['success' => false, 'error' => 'Import is limited to 1,000 records per request.'], 400);
        }
        $company = Scope::companyFilter($user);
        $imported = [];
        $rejected = [];
        $seen = [];
        foreach (array_values($records) as $index => $record) {
            $record = is_array($record) ? $record : [];
            $mobile = trim((string) ($record['mobile'] ?? ''));
            $rowNumber = $index + 2;
            if (trim((string) ($record['full_name'] ?? '')) === '' || $mobile === '') {
                $rejected[] = ['row' => $rowNumber, 'reason' => 'Name and mobile are required.'];
                continue;
            }
            if (isset($seen[$mobile])) {
                $rejected[] = ['row' => $rowNumber, 'reason' => 'Duplicate mobile in this file.'];
                continue;
            }
            $seen[$mobile] = true;
            if ($this->db->exists(Collections::LEADS, Scope::combine($company, ['mobile' => $mobile]))) {
                $rejected[] = ['row' => $rowNumber, 'reason' => 'This mobile already exists in your company CRM.'];
                continue;
            }
            try {
                $lead = $this->createLead($record, $user);
                $imported[] = $this->serialize($this->withRelations([$lead])[0]);
            } catch (HttpException $error) {
                $rejected[] = ['row' => $rowNumber, 'reason' => $error->getMessage()];
            } catch (Throwable $error) {
                $rejected[] = ['row' => $rowNumber, 'reason' => 'Could not import this row.'];
            }
        }
        return Response::json([
            'success' => true,
            'data' => [
                'imported' => count($imported),
                'rejected' => $rejected,
                'leads' => $imported,
            ],
        ]);
    }

    public function export(Request $request): Response
    {
        $user = Guard::user($request);
        if (!in_array($user['role'] ?? '', ['super_admin', 'admin', 'team_lead'], true)) {
            return Response::json(['success' => false, 'error' => 'You do not have permission to export leads.'], 403);
        }
        $leads = $this->withRelations($this->db->find(Collections::LEADS, Scope::visibleLeadFilter($this->db, $user), [
            'sort' => ['created_at' => -1],
        ]));
        $rows = [[
            'Company', 'Company Code', 'Lead Code', 'Name', 'Mobile', 'Email', 'City', 'Location',
            'Property Type', 'Budget Min', 'Budget Max', 'Priority', 'Status', 'Owner', 'Created Date',
        ]];
        foreach ($leads as $lead) {
            $row = $this->serialize($lead);
            $rows[] = [
                $row['company_name'], $row['company_code'], $row['lead_code'], $row['full_name'], $row['mobile'],
                $row['email'], $row['city'], $row['location'], $row['property_type'], $row['budget_min'],
                $row['budget_max'], $row['priority'], $row['status_name'], $row['owner_name'], $row['created_at'],
            ];
        }
        $csv = implode("\r\n", array_map(static function (array $row): string {
            return implode(',', array_map(static fn ($value): string => '"' . str_replace('"', '""', (string) ($value ?? '')) . '"', $row));
        }, $rows));
        return Response::json(['success' => true, 'data' => ['csv' => $csv, 'total' => count($leads)]]);
    }

    private function visibleLead(array $user, mixed $id): array|Response
    {
        $oid = Doc::oid($id);
        if ($oid === null) {
            return Response::json(['success' => false, 'error' => 'Invalid lead ID.'], 400);
        }
        $lead = $this->db->findOne(Collections::LEADS, Scope::combine(Scope::visibleLeadFilter($this->db, $user), ['_id' => $oid]));
        if ($lead === null) {
            return Response::json(['success' => false, 'error' => 'Lead not found.'], 404);
        }
        return $lead;
    }

    private function createLead(array $data, array $user): array
    {
        if (($user['role'] ?? '') === 'super_admin') {
            throw new HttpException(403, 'Super Admin has read-only access to leads.');
        }
        $values = $this->validate($data);
        $companyId = Scope::companyFilter($user)['company_id'];
        $property = (string) ($data['property_type'] ?? 'apartment');
        if (!in_array($property, Catalog::PROPERTY_TYPES, true)) {
            throw new HttpException(400, 'Invalid property type.');
        }
        $consent = $data['consent_whatsapp'] ?? false;
        return $this->db->insert(Collections::LEADS, [
            'company_id' => $companyId,
            'lead_code' => 'YH-' . (int) (microtime(true) * 1000) . '-' . strtoupper(substr((string) new ObjectId(), -6)),
            'full_name' => $values['full_name'],
            'mobile' => $values['mobile'],
            'email' => strtolower(trim((string) ($data['email'] ?? ''))),
            'city' => trim((string) ($data['city'] ?? '')),
            'location' => trim((string) ($data['location'] ?? '')),
            'property_type' => $property,
            'preferred_configuration' => (string) ($data['preferred_configuration'] ?? '2 BHK'),
            'budget_min' => $values['budget_min'],
            'budget_max' => $values['budget_max'],
            'source_id' => $values['source_id'],
            'priority' => $values['priority'],
            'requirements' => (string) ($data['requirements'] ?? ''),
            'consent_whatsapp' => $consent === true || $consent === 1 || $consent === '1' || $consent === 'true',
            'status_id' => $values['status_id'],
            'owner' => ($user['role'] ?? '') === 'employee' ? $user['_id'] : null,
            'created_by' => $user['_id'],
            'next_follow_up_at' => null,
        ]);
    }

    private function validate(array $data): array
    {
        $name = trim((string) ($data['full_name'] ?? ''));
        $mobile = trim((string) ($data['mobile'] ?? ''));
        if ($name === '' || $mobile === '') {
            throw new HttpException(400, 'Full name and mobile are required.');
        }
        $budgetMin = ($data['budget_min'] ?? null) === '' || ($data['budget_min'] ?? null) === null ? null : $data['budget_min'];
        $budgetMax = ($data['budget_max'] ?? null) === '' || ($data['budget_max'] ?? null) === null ? null : $data['budget_max'];
        if (($budgetMin !== null && !is_numeric($budgetMin)) || ($budgetMax !== null && !is_numeric($budgetMax))) {
            throw new HttpException(400, 'Budget values must be valid numbers.');
        }
        $budgetMin = $budgetMin === null ? null : (float) $budgetMin;
        $budgetMax = $budgetMax === null ? null : (float) $budgetMax;
        if ($budgetMin !== null && $budgetMax !== null && $budgetMin > $budgetMax) {
            throw new HttpException(400, 'Minimum budget cannot exceed maximum budget.');
        }
        $priority = array_key_exists((string) ($data['priority'] ?? ''), Catalog::PRIORITY) ? (string) $data['priority'] : 'medium';
        $statusId = (int) ($data['status_id'] ?? 1) ?: 1;
        $sourceId = (int) ($data['source_id'] ?? 1) ?: 1;
        if (!Catalog::validStatus($statusId)) {
            throw new HttpException(400, 'Invalid lead status.');
        }
        if (!Catalog::validSource($sourceId)) {
            throw new HttpException(400, 'Invalid lead source.');
        }
        return [
            'full_name' => $name,
            'mobile' => $mobile,
            'budget_min' => $budgetMin,
            'budget_max' => $budgetMax,
            'priority' => $priority,
            'status_id' => $statusId,
            'source_id' => $sourceId,
        ];
    }

    private function withRelations(array $leads): array
    {
        $leads = $this->db->populate($leads, 'owner', Collections::USERS, ['full_name']);
        return $this->db->populate($leads, 'company_id', Collections::COMPANIES, ['name', 'code']);
    }

    public function serialize(array $lead): array
    {
        $company = is_array($lead['company_id'] ?? null) ? $lead['company_id'] : [];
        $owner = is_array($lead['owner'] ?? null) ? $lead['owner'] : [];
        return [
            'id' => (string) $lead['_id'],
            'lead_code' => $lead['lead_code'] ?? '',
            'full_name' => $lead['full_name'] ?? '',
            'mobile' => $lead['mobile'] ?? '',
            'email' => $lead['email'] ?? '',
            'city' => $lead['city'] ?? '',
            'location' => $lead['location'] ?? '',
            'property_type' => $lead['property_type'] ?? '',
            'budget_min' => $lead['budget_min'] ?? null,
            'budget_max' => $lead['budget_max'] ?? null,
            'preferred_configuration' => $lead['preferred_configuration'] ?? '',
            'source_id' => $lead['source_id'] ?? 1,
            'priority' => $lead['priority'] ?? 'medium',
            'requirements' => $lead['requirements'] ?? '',
            'consent_whatsapp' => (bool) ($lead['consent_whatsapp'] ?? false),
            'status_id' => $lead['status_id'] ?? 1,
            'status_name' => Catalog::statusName($lead['status_id'] ?? 1),
            'owner_name' => $owner['full_name'] ?? null,
            'owner_id' => Doc::idString($lead['owner'] ?? null),
            'company_id' => Doc::idString($lead['company_id'] ?? null),
            'company_name' => $company['name'] ?? null,
            'company_code' => $company['code'] ?? null,
            'next_follow_up_at' => Doc::iso($lead['next_follow_up_at'] ?? null),
            'created_at' => Doc::iso($lead['created_at'] ?? null),
        ];
    }
}
