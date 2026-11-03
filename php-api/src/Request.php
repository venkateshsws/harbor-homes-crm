<?php

declare(strict_types=1);

namespace YahooCrm;

final class Request
{
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $body,
        public readonly array $cookies,
        public readonly array $headers,
        public readonly string $ip,
        public readonly ?string $userAgent,
        public ?array $user = null,
        public ?array $session = null,
        public array $params = [],
    ) {
    }

    public static function fromGlobals(int $maxBytes = 1048576): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $path = '/' . trim($path, '/');
        if ($path !== '/') {
            $path = rtrim($path, '/') ?: '/';
        }

        $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($length > $maxBytes) {
            throw new HttpException(413, 'Request body is too large.');
        }

        $raw = '';
        if ($length > 0) {
            $raw = file_get_contents('php://input', false, null, 0, $length);
            if ($raw === false) {
                $raw = '';
            }
        }
        if (strlen($raw) > $maxBytes) {
            throw new HttpException(413, 'Request body is too large.');
        }

        $body = [];
        if ($raw !== '') {
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                throw new HttpException(400, 'Request body must be valid JSON.');
            }
            $body = $decoded;
        }

        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = is_string($value) ? $value : '';
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }

        return new self(
            $method,
            $path,
            $_GET,
            $body,
            $_COOKIE,
            $headers,
            self::clientIp(),
            isset($_SERVER['HTTP_USER_AGENT']) ? substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 300) : null,
        );
    }

    public function header(string $name): string
    {
        return $this->headers[strtolower($name)] ?? '';
    }

    public function cookie(string $name): string
    {
        $value = $this->cookies[$name] ?? '';
        return is_string($value) ? $value : '';
    }

    private static function clientIp(): string
    {
        $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        $forwarded = (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
        if (self::isLoopback($remote) && $forwarded !== '') {
            return trim(explode(',', $forwarded)[0]);
        }
        return $remote;
    }

    private static function isLoopback(string $ip): bool
    {
        return $ip === '127.0.0.1' || $ip === '::1' || $ip === '::ffff:127.0.0.1';
    }
}
