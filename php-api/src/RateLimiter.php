<?php

declare(strict_types=1);

namespace YahooCrm;

final class RateLimiter
{
    public function __construct(private readonly string $directory)
    {
    }

    public function blocked(string $key, int $limit, int $windowSeconds): bool
    {
        $state = $this->read($key, $windowSeconds);
        return $state['fails'] >= $limit;
    }

    public function hit(string $key, int $windowSeconds): void
    {
        $path = $this->path($key);
        $handle = fopen($path, 'c+');
        if ($handle === false) {
            return;
        }
        try {
            flock($handle, LOCK_EX);
            $state = $this->decode((string) stream_get_contents($handle), $windowSeconds);
            $state['fails']++;
            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode($state));
            fflush($handle);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function read(string $key, int $windowSeconds): array
    {
        $path = $this->path($key);
        if (!is_file($path)) {
            return ['fails' => 0, 'reset' => time() + $windowSeconds];
        }
        $raw = file_get_contents($path);
        return $this->decode(is_string($raw) ? $raw : '', $windowSeconds);
    }

    private function decode(string $raw, int $windowSeconds): array
    {
        $data = json_decode($raw, true);
        $now = time();
        if (!is_array($data) || (int) ($data['reset'] ?? 0) <= $now) {
            return ['fails' => 0, 'reset' => $now + $windowSeconds];
        }
        return [
            'fails' => (int) ($data['fails'] ?? 0),
            'reset' => (int) $data['reset'],
        ];
    }

    private function path(string $key): string
    {
        if (!is_dir($this->directory) && !mkdir($this->directory, 0700, true) && !is_dir($this->directory)) {
            throw new \RuntimeException('Unable to create rate limit storage.');
        }
        return $this->directory . '/' . hash('sha256', $key) . '.json';
    }
}
