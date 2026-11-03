<?php

declare(strict_types=1);

use YahooCrm\Clock;
use YahooCrm\HttpException;
use YahooCrm\Password;
use YahooCrm\Request;
use YahooCrm\Response;
use YahooCrm\Router;

require dirname(__DIR__) . '/src/autoload.php';

$failed = 0;

function check(bool $condition, string $label): void
{
    global $failed;
    if ($condition) {
        echo "PASS {$label}\n";
        return;
    }
    $failed++;
    echo "FAIL {$label}\n";
}

$vector = 'scrypt$32768$8$1$MDEyMzQ1Njc4OWFiY2RlZg==$uK8AZXpLRMU1BKifIbu19UBqi1A3bGj90xJ9CTrs6fJG0xIS+3GO/Wu/abM7pZHvQVybTvPsRGh3DbzX92Ro1w==';
check(Password::verify('Password123!', $vector), 'verifies a Node.js scrypt password hash');
check(!Password::verify('wrong-password', $vector), 'rejects a wrong password');
check(Password::verify(Password::problem('short') !== null ? 'abcdefghij' : 'abcdefghij', Password::hash('abcdefghij')), 'hashes and verifies a new password');
check(Password::problem('short') === 'Password must be at least 10 characters.', 'enforces the 10 character password rule');

$midnight = Clock::zonedMidnightToUtc('2026-11-02', 'Asia/Kolkata');
check($midnight->format('Y-m-d H:i:s') === '2026-11-01 18:30:00', 'converts Kolkata midnight to UTC');
check(Clock::addDays('2026-11-02', -6) === '2026-10-27', 'adds calendar days');

$router = new Router();
$router->map('GET', '/api/leads/meta', static fn () => Response::json(['ok' => 'meta']));
$router->map('GET', '/api/leads/{id}', static fn ($request) => Response::json(['id' => $request->params['id']]));
$meta = $router->dispatch(new Request('GET', '/api/leads/meta', [], [], [], [], '127.0.0.1', null));
$item = $router->dispatch(new Request('GET', '/api/leads/abc', [], [], [], [], '127.0.0.1', null));
$missing = $router->dispatch(new Request('POST', '/api/missing', [], [], [], [], '127.0.0.1', null));
check(($meta->body['ok'] ?? null) === 'meta', 'matches a static route before a parameter route');
check(($item->body['id'] ?? null) === 'abc', 'captures a route parameter');
check($missing->status === 404, 'returns not found for an unknown route');

try {
    Clock::monthBounds('2026-13');
    check(false, 'rejects an invalid month');
} catch (HttpException $error) {
    check($error->status === 400, 'rejects an invalid month');
}

exit($failed === 0 ? 0 : 1);
