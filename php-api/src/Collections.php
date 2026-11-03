<?php

declare(strict_types=1);

namespace YahooCrm;

final class Collections
{
    public const USERS = 'users';
    public const SESSIONS = 'sessions';
    public const COMPANIES = 'companies';
    public const LEADS = 'leads';
    public const ATTENDANCES = 'attendances';
    public const FOLLOWUPS = 'followups';
    public const LEADCALLS = 'leadcalls';
    public const SITEVISITS = 'sitevisits';
    public const DRIPCAMPAIGNS = 'dripcampaigns';
    public const DRIPENROLLMENTS = 'dripenrollments';
    public const DRIPMESSAGELOGS = 'dripmessagelogs';
    public const LEADNOTES = 'leadnotes';
    public const LEADASSIGNMENTS = 'leadassignments';
    public const RATE_LIMITS = 'login_rate_limits';

    /** @var array<string, array{0: string, 1: bool}> */
    private const TIMESTAMPS = [
        self::USERS => ['created_at', true],
        self::SESSIONS => ['created_at', false],
        self::COMPANIES => ['created_at', true],
        self::LEADS => ['created_at', true],
        self::ATTENDANCES => ['createdAt', true],
        self::FOLLOWUPS => ['created_at', true],
        self::LEADCALLS => ['created_at', true],
        self::SITEVISITS => ['created_at', true],
        self::DRIPCAMPAIGNS => ['created_at', true],
        self::DRIPENROLLMENTS => ['created_at', true],
        self::DRIPMESSAGELOGS => ['created_at', true],
        self::LEADNOTES => ['created_at', false],
        self::LEADASSIGNMENTS => ['created_at', false],
    ];

    public static function name(string $logical): string
    {
        $override = getenv('MONGODB_COLLECTION_' . strtoupper($logical));
        if (is_string($override) && trim($override) !== '') {
            return trim($override);
        }
        return $logical;
    }

    /** @return array{0: string, 1: string|null, 2: bool} */
    public static function timestamps(string $logical): array
    {
        $pair = self::TIMESTAMPS[$logical] ?? ['created_at', true];
        $created = $pair[0];
        $updated = null;
        if ($created === 'createdAt') {
            $updated = 'updatedAt';
        } elseif ($pair[1]) {
            $updated = 'updated_at';
        }
        $version = !in_array($logical, [self::LEADNOTES, self::LEADASSIGNMENTS, self::RATE_LIMITS], true);
        return [$created, $updated, $version];
    }
}
