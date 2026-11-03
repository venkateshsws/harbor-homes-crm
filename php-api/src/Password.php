<?php

declare(strict_types=1);

namespace YahooCrm;

final class Password
{
    public const MIN_LENGTH = 10;
    private const N = 32768;
    private const R = 8;
    private const P = 1;
    private const KEY_LENGTH = 64;

    private static ?string $dummyHash = null;

    public static function hash(string $password): string
    {
        $salt = random_bytes(16);
        $key = self::derive($password, $salt, self::N, self::R, self::P, self::KEY_LENGTH);

        return implode('$', [
            'scrypt',
            (string) self::N,
            (string) self::R,
            (string) self::P,
            base64_encode($salt),
            base64_encode($key),
        ]);
    }

    public static function verify(string $password, ?string $stored): bool
    {
        if ($stored === null || $stored === '') {
            self::$dummyHash ??= self::hash(bin2hex(random_bytes(16)));
            self::verify($password, self::$dummyHash);
            return false;
        }

        $parts = explode('$', $stored);
        if (count($parts) !== 6 || $parts[0] !== 'scrypt') {
            return false;
        }

        [, $n, $r, $p, $saltB64, $keyB64] = $parts;
        $salt = base64_decode($saltB64, true);
        $expected = base64_decode($keyB64, true);
        if ($salt === false || $expected === false || $expected === '') {
            return false;
        }

        $actual = self::derive($password, $salt, (int) $n, (int) $r, (int) $p, strlen($expected));
        if (strlen($actual) !== strlen($expected)) {
            return false;
        }

        return hash_equals($expected, $actual);
    }

    public static function problem(string $password): ?string
    {
        if (strlen($password) < self::MIN_LENGTH) {
            return 'Password must be at least ' . self::MIN_LENGTH . ' characters.';
        }
        if (strlen($password) > 200) {
            return 'Password must be at most 200 characters.';
        }
        return null;
    }

    private static function derive(string $password, string $salt, int $n, int $r, int $p, int $length): string
    {
        if (in_array('scrypt', hash_algos(), true)) {
            $raw = hash('scrypt', $password, true, [
                'salt' => $salt,
                'cost' => $n,
                'block_size' => $r,
                'parallelization' => $p,
            ]);
            if (!is_string($raw) || strlen($raw) < $length) {
                throw new \RuntimeException('PHP scrypt did not return the expected key length.');
            }
            return substr($raw, 0, $length);
        }

        return Scrypt::derive($password, $salt, $n, $r, $p, $length);
    }
}
