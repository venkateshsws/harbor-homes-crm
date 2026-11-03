<?php

declare(strict_types=1);

namespace YahooCrm;

final class Env
{
    public string $appEnv;
    public string $host;
    public int $port;
    public string $mongodbUri;
    public string $mongodbDbName;
    public int $sessionTtlHours;
    public string $timezone;

    private function __construct()
    {
    }

    public static function load(string $root): self
    {
        self::readFile($root . '/.env');

        $env = new self();
        $env->appEnv = self::string('APP_ENV', 'development');
        $env->host = self::string('HOST', '127.0.0.1');
        $env->port = self::int('PORT', 8080);
        $env->mongodbUri = self::string('MONGODB_URI', '');
        $env->mongodbDbName = self::string('MONGODB_DB_NAME', '');
        $ttl = self::int('SESSION_TTL_HOURS', 12);
        $env->sessionTtlHours = $ttl > 0 ? $ttl : 12;
        $env->timezone = self::string('APP_TIMEZONE', 'Asia/Kolkata');

        return $env;
    }

    public function isProduction(): bool
    {
        return $this->appEnv === 'production';
    }

    public function redact(string $text): string
    {
        $out = $this->mongodbUri !== '' ? str_replace($this->mongodbUri, '<MONGODB_URI>', $text) : $text;

        return preg_replace('/(mongodb(?:\+srv)?:\/\/)[^@\s\/]+@/i', '$1<credentials>@', $out) ?? $out;
    }

    private static function readFile(string $path): void
    {
        if (!is_file($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES);
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            $eq = strpos($line, '=');
            if ($eq === false) {
                continue;
            }
            $key = trim(substr($line, 0, $eq));
            $value = trim(substr($line, $eq + 1));
            if ($value !== '' && ($value[0] === '"' || $value[0] === "'")) {
                $value = trim($value, "\"'");
            }
            if ($key !== '' && getenv($key) === false) {
                putenv($key . '=' . $value);
                $_ENV[$key] = $value;
            }
        }
    }

    private static function string(string $key, string $default): string
    {
        $value = getenv($key);
        if ($value === false) {
            return $default;
        }
        return trim($value);
    }

    private static function int(string $key, int $default): int
    {
        $value = self::string($key, '');
        if ($value === '' || !is_numeric($value)) {
            return $default;
        }
        return (int) $value;
    }
}
