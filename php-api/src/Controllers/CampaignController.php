<?php

declare(strict_types=1);

namespace YahooCrm\Controllers;

use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Guard;
use YahooCrm\Request;
use YahooCrm\Response;
use YahooCrm\Scope;
use MongoDB\BSON\ObjectId;
use Throwable;

final class CampaignController
{
    public function __construct(private readonly Database $db)
    {
    }

    public function index(Request $request): Response
    {
        $user = Guard::role($request, ['super_admin', 'admin']);
        $rows = $this->db->find(Collections::DRIPCAMPAIGNS, $this->scope($user), ['sort' => ['updated_at' => -1]]);
        return Response::json(['success' => true, 'data' => Doc::jsonable($rows)]);
    }

    public function show(Request $request): Response
    {
        $user = Guard::role($request, ['super_admin', 'admin']);
        $campaign = $this->one($user, $request->params['id'] ?? null);
        if ($campaign instanceof Response) {
            return $campaign;
        }
        return Response::json(['success' => true, 'data' => Doc::jsonable($campaign)]);
    }

    public function create(Request $request): Response
    {
        $user = Guard::role($request, ['super_admin', 'admin']);
        $name = trim((string) ($request->body['name'] ?? ''));
        $description = (string) ($request->body['description'] ?? '');
        $trigger = (string) ($request->body['trigger'] ?? 'manual');
        $steps = $request->body['steps'] ?? null;
        $statusId = $request->body['trigger_status_id'] ?? null;
        $triggerStatus = $statusId === null || $statusId === '' ? null : (int) $statusId;
        if ($name === '') {
            return Response::json(['success' => false, 'error' => 'Campaign name is required.'], 400);
        }
        if (strlen($name) > 120 || strlen($description) > 1000) {
            return Response::json(['success' => false, 'error' => 'Campaign name or description is too long.'], 400);
        }
        if (!in_array($trigger, ['manual', 'new_lead', 'status_change'], true)) {
            return Response::json(['success' => false, 'error' => 'Invalid campaign trigger.'], 400);
        }
        if ($trigger === 'status_change' && ($triggerStatus === null || $triggerStatus < 1 || $triggerStatus > 5)) {
            return Response::json(['success' => false, 'error' => 'Choose a valid lead status for this trigger.'], 400);
        }
        $error = $this->validateSteps($steps);
        if ($error !== null) {
            return Response::json(['success' => false, 'error' => $error], 400);
        }
        $campaign = $this->db->insert(Collections::DRIPCAMPAIGNS, [
            'name' => $name,
            'description' => $description,
            'trigger' => $trigger,
            'trigger_status_id' => $triggerStatus,
            'steps' => $this->normalizeSteps($steps),
            'status' => 'draft',
            'created_by' => $user['_id'],
            'company_id' => Scope::companyId($user),
        ]);
        return Response::json([
            'success' => true,
            'data' => Doc::jsonable($campaign),
            'message' => 'Campaign created in draft mode. No WhatsApp messages were sent.',
        ], 201);
    }

    public function update(Request $request): Response
    {
        $user = Guard::role($request, ['super_admin', 'admin']);
        $campaign = $this->one($user, $request->params['id'] ?? null);
        if ($campaign instanceof Response) {
            return $campaign;
        }
        if (($campaign['status'] ?? '') === 'active') {
            return Response::json(['success' => false, 'error' => 'Pause the campaign before editing it.'], 409);
        }
        $updates = [];
        $body = $request->body;
        if (array_key_exists('name', $body)) {
            $name = trim((string) $body['name']);
            if ($name === '' || strlen($name) > 120) {
                return Response::json(['success' => false, 'error' => 'Campaign name is required and must be under 120 characters.'], 400);
            }
            $updates['name'] = $name;
        }
        if (array_key_exists('description', $body)) {
            $description = (string) $body['description'];
            if (strlen($description) > 1000) {
                return Response::json(['success' => false, 'error' => 'Description must be under 1,000 characters.'], 400);
            }
            $updates['description'] = $description;
        }
        if (array_key_exists('trigger', $body)) {
            if (!in_array($body['trigger'], ['manual', 'new_lead', 'status_change'], true)) {
                return Response::json(['success' => false, 'error' => 'Invalid campaign trigger.'], 400);
            }
            $updates['trigger'] = $body['trigger'];
        }
        $trigger = $updates['trigger'] ?? $campaign['trigger'];
        if (array_key_exists('trigger_status_id', $body)) {
            $value = $body['trigger_status_id'] === null || $body['trigger_status_id'] === '' ? null : (int) $body['trigger_status_id'];
            if ($trigger === 'status_change' && ($value === null || $value < 1 || $value > 5)) {
                return Response::json(['success' => false, 'error' => 'Choose a valid lead status for this trigger.'], 400);
            }
            $updates['trigger_status_id'] = $value;
        }
        if (array_key_exists('steps', $body)) {
            $error = $this->validateSteps($body['steps']);
            if ($error !== null) {
                return Response::json(['success' => false, 'error' => $error], 400);
            }
            $updates['steps'] = $this->normalizeSteps($body['steps']);
        }
        $saved = $updates === [] ? $campaign : $this->db->replaceFields(Collections::DRIPCAMPAIGNS, ['_id' => $campaign['_id']], $updates);
        return Response::json(['success' => true, 'data' => Doc::jsonable($saved), 'message' => 'Campaign updated.']);
    }

    public function activate(Request $request): Response
    {
        return $this->setStatus($request, 'active');
    }

    public function pause(Request $request): Response
    {
        return $this->setStatus($request, 'paused');
    }

    public function enroll(Request $request): Response
    {
        $user = Guard::role($request, ['super_admin', 'admin']);
        $campaign = $this->one($user, $request->params['id'] ?? null);
        if ($campaign instanceof Response) {
            return $campaign;
        }
        $leadIds = $request->body['lead_ids'] ?? null;
        if (!is_array($leadIds) || count($leadIds) < 1 || count($leadIds) > 100) {
            return Response::json(['success' => false, 'error' => 'Provide between 1 and 100 lead IDs.'], 400);
        }
        $oids = [];
        foreach ($leadIds as $leadId) {
            $oid = Doc::oid($leadId);
            if ($oid === null) {
                return Response::json(['success' => false, 'error' => 'One or more lead IDs are invalid.'], 400);
            }
            $oids[(string) $oid] = $oid;
        }
        if (($campaign['status'] ?? '') !== 'active') {
            return Response::json(['success' => false, 'error' => 'Activate the campaign before enrolling leads.'], 409);
        }
        $leadFilter = ['_id' => ['$in' => array_values($oids)], 'consent_whatsapp' => true];
        if (($user['role'] ?? '') === 'admin') {
            $leadFilter['company_id'] = Scope::companyId($user);
        }
        $leads = $this->db->find(Collections::LEADS, $leadFilter, ['projection' => ['_id' => 1]]);
        $found = [];
        foreach ($leads as $lead) {
            $found[(string) $lead['_id']] = true;
        }
        $missing = array_values(array_filter(array_keys($oids), static fn (string $id): bool => !isset($found[$id])));
        if ($missing !== []) {
            return Response::json([
                'success' => false,
                'error' => 'Some leads do not exist or have not granted WhatsApp consent.',
                'rejected_lead_ids' => $missing,
            ], 400);
        }
        $steps = array_values(array_filter($campaign['steps'] ?? [], static fn (array $step): bool => ($step['is_active'] ?? true) !== false));
        usort($steps, static fn (array $a, array $b): int => ($a['step_number'] ?? 0) <=> ($b['step_number'] ?? 0));
        if ($steps === []) {
            return Response::json(['success' => false, 'error' => 'This campaign has no active message steps.'], 400);
        }
        $first = $steps[0];
        $results = [];
        foreach ($leads as $lead) {
            if ($this->db->exists(Collections::DRIPENROLLMENTS, ['campaign' => $campaign['_id'], 'lead' => $lead['_id']])) {
                $results[] = ['lead_id' => (string) $lead['_id'], 'status' => 'already_enrolled'];
                continue;
            }
            try {
                $this->db->insert(Collections::DRIPENROLLMENTS, [
                    'campaign' => $campaign['_id'],
                    'lead' => $lead['_id'],
                    'current_step' => $first['step_number'] ?? 1,
                    'status' => 'active',
                    'next_message_at' => Doc::date((new \DateTimeImmutable('now'))->modify('+' . (int) $first['delay_minutes'] . ' minutes')),
                    'enrolled_at' => Doc::date(),
                    'completed_at' => null,
                    'stopped_reason' => '',
                    'enrolled_by' => $user['_id'],
                    'company_id' => Scope::companyId($user),
                ]);
                $results[] = ['lead_id' => (string) $lead['_id'], 'status' => 'enrolled_test_mode'];
            } catch (Throwable $error) {
                if (Doc::duplicate($error)) {
                    $results[] = ['lead_id' => (string) $lead['_id'], 'status' => 'already_enrolled'];
                    continue;
                }
                throw $error;
            }
        }
        return Response::json([
            'success' => true,
            'data' => $results,
            'message' => 'Enrollments recorded. WhatsApp sending is not enabled.',
        ], 201);
    }

    public function enrollments(Request $request): Response
    {
        $user = Guard::role($request, ['super_admin', 'admin']);
        $campaign = $this->one($user, $request->params['id'] ?? null);
        if ($campaign instanceof Response) {
            return $campaign;
        }
        $filter = ['campaign' => $campaign['_id']];
        if (($user['role'] ?? '') !== 'super_admin') {
            $filter['company_id'] = Scope::companyId($user);
        }
        $rows = $this->db->populate(
            $this->db->find(Collections::DRIPENROLLMENTS, $filter, ['sort' => ['created_at' => -1], 'limit' => 500]),
            'lead',
            Collections::LEADS,
            ['full_name', 'mobile', 'lead_code', 'status_id'],
        );
        return Response::json(['success' => true, 'data' => Doc::jsonable($rows)]);
    }

    private function setStatus(Request $request, string $status): Response
    {
        $user = Guard::role($request, ['super_admin', 'admin']);
        $campaign = $this->one($user, $request->params['id'] ?? null);
        if ($campaign instanceof Response) {
            return $campaign;
        }
        if ($status === 'active') {
            $active = false;
            foreach ($campaign['steps'] ?? [] as $step) {
                if (($step['is_active'] ?? true) !== false) {
                    $active = true;
                }
            }
            if (!$active) {
                return Response::json(['success' => false, 'error' => 'Add at least one active message step before activation.'], 400);
            }
        }
        $saved = $this->db->replaceFields(Collections::DRIPCAMPAIGNS, ['_id' => $campaign['_id']], ['status' => $status]);
        $message = $status === 'active'
            ? 'Campaign activated in configuration-only mode. Sending is not enabled.'
            : 'Campaign paused. No new messages will be sent.';
        return Response::json(['success' => true, 'data' => Doc::jsonable($saved), 'message' => $message]);
    }

    private function one(array $user, mixed $id): array|Response
    {
        $oid = Doc::oid($id);
        if ($oid === null) {
            return Response::json(['success' => false, 'error' => 'Invalid campaign ID.'], 400);
        }
        $campaign = $this->db->findOne(Collections::DRIPCAMPAIGNS, Scope::combine($this->scope($user), ['_id' => $oid]));
        if ($campaign === null) {
            return Response::json(['success' => false, 'error' => 'Campaign not found.'], 404);
        }
        return $campaign;
    }

    private function scope(array $user): array
    {
        if (($user['role'] ?? '') === 'super_admin') {
            return [];
        }
        $companyId = Scope::companyId($user);
        if ($companyId === null) {
            return ['created_by' => $user['_id']];
        }
        return ['$or' => [
            ['company_id' => $companyId],
            ['created_by' => $user['_id'], 'company_id' => null],
        ]];
    }

    private function validateSteps(mixed $steps): ?string
    {
        if (!is_array($steps) || $steps === []) {
            return 'Add at least one message step.';
        }
        if (count($steps) > 20) {
            return 'A campaign can have at most 20 steps.';
        }
        foreach (array_values($steps) as $index => $step) {
            $step = is_array($step) ? $step : [];
            $delay = $step['delay_minutes'] ?? null;
            if (!is_numeric($delay) || (int) $delay != (float) $delay || (int) $delay < 0 || (int) $delay > 525600) {
                return 'Step ' . ($index + 1) . ' must have a valid delay in minutes.';
            }
            $template = $step['template_name'] ?? '';
            if (!is_string($template) || !preg_match('/^[a-zA-Z0-9_]+$/', trim($template))) {
                return 'Step ' . ($index + 1) . ' must have a valid WhatsApp template name.';
            }
            if (isset($step['language_code']) && $step['language_code'] !== null && !preg_match('/^[a-z]{2,3}(?:_[A-Z]{2})?$/', (string) $step['language_code'])) {
                return 'Step ' . ($index + 1) . ' has an invalid language code.';
            }
        }
        return null;
    }

    private function normalizeSteps(array $steps): array
    {
        $out = [];
        foreach (array_values($steps) as $index => $step) {
            $out[] = [
                '_id' => new ObjectId(),
                'step_number' => $index + 1,
                'delay_minutes' => (int) $step['delay_minutes'],
                'template_name' => trim((string) $step['template_name']),
                'language_code' => $step['language_code'] ?? 'en',
                'is_active' => ($step['is_active'] ?? true) !== false,
            ];
        }
        return $out;
    }
}
