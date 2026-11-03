<?php

declare(strict_types=1);

namespace YahooCrm;

final class HttpException extends \RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}
