# Yahoo CRM PHP API

This folder is a PHP 8.2+ replacement for `backend/`. The Node.js backend is unchanged.

The React app stays in `frontend/`. In production, serve the React build at `/` and this API at `/api/` on the same domain. See `deploy/nginx.conf.example`.

## Requirements

- PHP 8.2 or newer with `ext-mongodb`, `ext-hash`, `ext-json`, `ext-mbstring`, and `ext-openssl`
- Composer
- The existing MongoDB database. Do not create a second database and do not rename collections.

## Local setup

```bat
cd php-api
copy .env.example .env
```

Put the same `MONGODB_URI` and `MONGODB_DB_NAME` used by the Node backend into `php-api/.env`. Never commit that file.

```bat
composer install
php -S 127.0.0.1:8080 -t public public/router.php
```

Point the React dev server at it by setting this in `frontend/.env.local`:

```
HH_BACKEND_URL=http://127.0.0.1:8080
```

Then run `npm --prefix frontend run dev`.

Create accounts only through the prompt. There are no demo passwords in this API:

```bat
php scripts/create-user.php super_admin
```

## Checks that do not need MongoDB

```bat
php tests/run.php
```

That checks Node.js scrypt password compatibility, Kolkata date conversion, and route matching.

## Not migrated

The Express API never stored teams, properties, notifications, settings, audit logs, nurturing sequences, or WhatsApp sends. Those React screens still call routes that only the Vite demo middleware implemented. This PHP API does not invent records for them.
