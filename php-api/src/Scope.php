<?php

declare(strict_types=1);

namespace YahooCrm;

use MongoDB\BSON\ObjectId;

final class Scope
{
    public static function companyId(array $user): ?ObjectId
    {
        return Doc::oid($user['company_id'] ?? null);
    }

    public static function teamId(array $user): ?ObjectId
    {
        return Doc::oid($user['team_id'] ?? null);
    }

    public static function requireCompany(array $user): ObjectId
    {
        if (($user['role'] ?? '') === 'super_admin') {
            throw new HttpException(403, 'Your account is not assigned to a valid company.');
        }
        $id = self::companyId($user);
        if ($id === null) {
            throw new HttpException(403, 'Your account is not assigned to a valid company.');
        }
        return $id;
    }

    public static function companyFilter(array $user): array
    {
        if (($user['role'] ?? '') === 'super_admin') {
            return [];
        }
        return ['company_id' => self::requireCompany($user)];
    }

    public static function combine(array ...$filters): array
    {
        $valid = array_values(array_filter($filters, static fn (array $filter): bool => $filter !== []));
        if (count($valid) === 0) {
            return [];
        }
        if (count($valid) === 1) {
            return $valid[0];
        }
        return ['$and' => $valid];
    }

    public static function canAssign(array $user): bool
    {
        return in_array($user['role'] ?? '', ['admin', 'team_lead'], true);
    }

    public static function visibleLeadFilter(Database $db, array $user): array
    {
        if (($user['role'] ?? '') === 'super_admin') {
            return [];
        }
        $company = self::companyFilter($user);
        if (($user['role'] ?? '') === 'admin') {
            return $company;
        }
        if (($user['role'] ?? '') === 'employee') {
            return self::combine($company, ['owner' => Doc::oid($user['_id'])]);
        }
        if (($user['role'] ?? '') === 'team_lead') {
            $teamId = self::teamId($user);
            if ($teamId === null) {
                return self::combine($company, ['_id' => null]);
            }
            $members = $db->find(Collections::USERS, [
                'company_id' => self::companyId($user),
                'team_id' => $teamId,
                'is_active' => true,
                'role' => 'employee',
            ], ['projection' => ['_id' => 1]]);
            $ids = array_map(static fn (array $member) => $member['_id'], $members);
            return self::combine($company, [
                '$or' => [
                    ['owner' => Doc::oid($user['_id'])],
                    ['owner' => ['$in' => $ids]],
                ],
            ]);
        }
        throw new HttpException(403, 'You do not have permission to view leads.');
    }

    /** @return list<ObjectId> */
    public static function activityUserIds(Database $db, array $user): array
    {
        $role = $user['role'] ?? '';
        if ($role === 'employee') {
            return [Doc::oid($user['_id'])];
        }
        if ($role === 'team_lead') {
            $teamId = self::teamId($user);
            $filter = [
                'company_id' => self::companyId($user),
                '$or' => [
                    ['_id' => Doc::oid($user['_id'])],
                ],
            ];
            if ($teamId !== null) {
                $filter['$or'][] = ['team_id' => $teamId, 'role' => 'employee'];
            }
            $users = $db->find(Collections::USERS, $filter, ['projection' => ['_id' => 1]]);
            $ids = array_map(static fn (array $item) => $item['_id'], $users);
            return $ids !== [] ? $ids : [Doc::oid($user['_id'])];
        }
        return [];
    }

    public static function activityFilter(Database $db, array $user): array
    {
        $role = $user['role'] ?? '';
        if ($role === 'super_admin') {
            return [];
        }
        $company = self::companyFilter($user);
        if ($role === 'admin') {
            return $company;
        }
        $ids = self::activityUserIds($db, $user);
        return self::combine($company, ['employee_id' => ['$in' => $ids]]);
    }

    public static function active(array $user): bool
    {
        return ($user['is_active'] ?? false) === true;
    }
}
