<?php

declare(strict_types=1);

namespace YahooCrm;

final class Response
{
    public int $status = 200;

    /** @var list<array{0: string, 1: string}> */
    public array $headers = [];

    public mixed $body = null;

    public static function json(array $data, int $status = 200): self
    {
        $response = new self();
        $response->status = $status;
        $response->body = $data;
        $response->headers[] = ['Content-Type', 'application/json; charset=utf-8'];
        return $response;
    }

    public static function emptyObject(): \stdClass
    {
        return new \stdClass();
    }

    public function cookie(string $name, string $value, int $maxAge, bool $secure): self
    {
        $parts = [
            rawurlencode($name) . '=' . rawurlencode($value),
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            'Max-Age=' . $maxAge,
        ];
        if ($secure) {
            $parts[] = 'Secure';
        }
        $this->headers[] = ['Set-Cookie', implode('; ', $parts)];
        return $this;
    }

    public function clearCookie(string $name, bool $secure): self
    {
        return $this->cookie($name, '', 0, $secure);
    }

    public function send(): void
    {
        http_response_code($this->status);
        header_remove('X-Powered-By');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
        header('Cache-Control: no-store');
        foreach ($this->headers as [$name, $value]) {
            header($name . ': ' . $value, false);
        }
        if ($this->body !== null) {
            echo json_encode($this->body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }
    }
}
