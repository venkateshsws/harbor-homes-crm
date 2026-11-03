<?php

declare(strict_types=1);

namespace YahooCrm;

final class Tokens
{
    public const COOKIE = 'hh_session';

    public static function random(int $bytes = 32): string
    {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function equals(string $left, string $right): bool
    {
        return hash_equals($left, $right);
    }
}
