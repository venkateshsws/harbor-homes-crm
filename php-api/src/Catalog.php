<?php

declare(strict_types=1);

namespace YahooCrm;

final class Catalog
{
    public const STATUSES = [
        ['id' => 1, 'name' => 'New'],
        ['id' => 2, 'name' => 'Interested'],
        ['id' => 3, 'name' => 'Schedule for site visit'],
        ['id' => 4, 'name' => 'Not interested'],
        ['id' => 5, 'name' => 'Follow up'],
    ];

    public const SOURCES = [
        ['id' => 1, 'name' => 'Website'],
        ['id' => 2, 'name' => 'Phone'],
        ['id' => 3, 'name' => 'WhatsApp'],
        ['id' => 4, 'name' => 'Referral'],
        ['id' => 5, 'name' => 'Other'],
    ];

    public const PRIORITY = [
        'urgent' => 0,
        'high' => 1,
        'medium' => 2,
        'low' => 3,
    ];

    public const ROLES = ['super_admin', 'admin', 'team_lead', 'employee'];

    public const ROLE_NAMES = [
        'super_admin' => 'Super Admin',
        'admin' => 'Company Admin',
        'team_lead' => 'Team Lead',
        'employee' => 'Employee',
    ];

    public const CALL_OUTCOMES = [
        'answered',
        'interested',
        'callback_requested',
        'no_answer',
        'busy',
        'switched_off',
        'not_interested',
        'invalid_number',
        'other',
    ];

    public const MISSED_OUTCOMES = ['no_answer', 'busy', 'switched_off', 'invalid_number'];

    public const PROPERTY_TYPES = ['apartment', 'villa', 'plot', 'commercial', 'other'];

    public static function statusName(mixed $id): string
    {
        foreach (self::STATUSES as $status) {
            if ($status['id'] === (int) $id) {
                return $status['name'];
            }
        }
        return 'New';
    }

    public static function sourceName(mixed $id): string
    {
        foreach (self::SOURCES as $source) {
            if ($source['id'] === (int) $id) {
                return $source['name'];
            }
        }
        return 'Other';
    }

    public static function validStatus(mixed $id): bool
    {
        return in_array((int) $id, array_column(self::STATUSES, 'id'), true);
    }

    public static function validSource(mixed $id): bool
    {
        return in_array((int) $id, array_column(self::SOURCES, 'id'), true);
    }
}
