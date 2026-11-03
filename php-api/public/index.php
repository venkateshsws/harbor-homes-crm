<?php

declare(strict_types=1);

use YahooCrm\App;
use YahooCrm\Env;

$root = dirname(__DIR__);

if (is_file($root . '/vendor/autoload.php')) {
    require $root . '/vendor/autoload.php';
} else {
    require $root . '/src/autoload.php';
}

try {
    App::boot($root)->run();
} catch (Throwable $error) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    $env = Env::load($root);
    $message = $env->redact($error->getMessage());
    $dir = $root . '/storage/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    @file_put_contents($dir . '/app.log', gmdate('c') . ' boot ' . $message . PHP_EOL, FILE_APPEND);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
    ]);
}
