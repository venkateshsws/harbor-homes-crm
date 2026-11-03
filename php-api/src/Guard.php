<?php

declare(strict_types=1);

namespace YahooCrm;

final class Guard
{
    public static function user(Request $request): array
    {
        if ($request->user === null) {
            throw new HttpException(401, 'Sign in required.');
        }
        return $request->user;
    }

    public static function role(Request $request, array $roles): array
    {
        $user = self::user($request);
        if (!in_array($user['role'] ?? '', $roles, true)) {
            throw new HttpException(403, 'You do not have permission to do this.');
        }
        return $user;
    }

    public static function email(string $value): bool
    {
        return (bool) preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $value);
    }
}
