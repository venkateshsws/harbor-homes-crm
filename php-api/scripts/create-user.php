<?php

declare(strict_types=1);

/**
 * Creates one user from prompts. Nothing is hardcoded.
 *
 * php scripts/create-user.php super_admin
 * php scripts/create-user.php admin
 * php scripts/create-user.php team_lead
 * php scripts/create-user.php employee
 */

use YahooCrm\Catalog;
use YahooCrm\Collections;
use YahooCrm\Database;
use YahooCrm\Doc;
use YahooCrm\Env;
use YahooCrm\Guard;
use YahooCrm\Password;

$root = dirname(__DIR__);
if (is_file($root . '/vendor/autoload.php')) {
    require $root . '/vendor/autoload.php';
} else {
    require $root . '/src/autoload.php';
}

$role = $argv[1] ?? '';
if (!in_array($role, Catalog::ROLES, true)) {
    fwrite(STDERR, "Usage: php scripts/create-user.php super_admin|admin|team_lead|employee\n");
    exit(1);
}

$ask = static function (string $label): string {
    fwrite(STDOUT, $label);
    $value = fgets(STDIN);
    return trim((string) $value);
};

$env = Env::load($root);

try {
    $db = new Database($env);
    $name = $ask('Full name: ');
    $email = strtolower($ask('Email: '));
    $code = strtoupper($ask('Employee ID: ') ?: ($role === 'super_admin' ? 'SA001' : 'EMP001'));
    $phone = $ask('Phone (optional): ');
    if ($name === '' || $email === '' || !Guard::email($email)) {
        throw new RuntimeException('A full name and valid email are required.');
    }
    $companyId = null;
    if (in_array($role, ['admin', 'team_lead', 'employee'], true)) {
        $companyId = $ask('Company ID: ');
        if (!YahooCrm\Doc::isOid($companyId) || !$db->exists(Collections::COMPANIES, ['_id' => YahooCrm\Doc::oid($companyId)])) {
            throw new RuntimeException('That company does not exist.');
        }
    }
    if ($db->exists(Collections::USERS, ['$or' => [['email' => $email], ['employee_code' => $code]]])) {
        throw new RuntimeException('An account with that email or employee ID already exists.');
    }
    $password = $ask('Password: ');
    $confirm = $ask('Confirm password: ');
    $problem = Password::problem($password);
    if ($problem !== null) {
        throw new RuntimeException($problem);
    }
    if ($password !== $confirm) {
        throw new RuntimeException('Passwords do not match.');
    }
    $user = $db->insert(Collections::USERS, [
        'full_name' => $name,
        'email' => $email,
        'employee_code' => $code,
        'phone' => $phone !== '' ? $phone : null,
        'role' => $role,
        'company_id' => $companyId ? YahooCrm\Doc::oid($companyId) : null,
        'team_id' => null,
        'is_assignment_eligible' => $role === 'employee',
        'is_active' => true,
        'timezone' => 'Asia/Kolkata',
        'password_hash' => Password::hash($password),
        'last_login_at' => null,
    ]);
    fwrite(STDOUT, "Created {$role} {$user['email']} ({$user['employee_code']}).\n");
} catch (Throwable $error) {
    fwrite(STDERR, 'FAILED: ' . $env->redact($error->getMessage()) . PHP_EOL);
    exit(1);
}
