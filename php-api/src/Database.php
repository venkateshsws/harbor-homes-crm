<?php

declare(strict_types=1);

namespace YahooCrm;

use MongoDB\BSON\ObjectId;
use MongoDB\Client;
use MongoDB\Collection;
use MongoDB\Model\BSONArray;
use MongoDB\Model\BSONDocument;
use MongoDB\Operation\FindOneAndUpdate;

final class Database
{
    private Client $client;
    private \MongoDB\Database $db;

    public function __construct(Env $env)
    {
        if ($env->mongodbUri === '') {
            throw new \RuntimeException('MONGODB_URI is not set. Copy php-api/.env.example to php-api/.env and set the existing MongoDB connection string.');
        }

        $uriOptions = [
            'serverSelectionTimeoutMS' => 15000,
            'serverSelectionTryOnce' => false,
        ];
        if ($env->mongodbDbName !== '') {
            $uriOptions['db'] = $env->mongodbDbName;
        }
        $caFile = getenv('MONGODB_TLS_CA_FILE');
        if (is_string($caFile) && is_file($caFile)) {
            $uriOptions['tlsCAFile'] = $caFile;
        }

        $this->client = new Client($env->mongodbUri, $uriOptions, [
            'typeMap' => [
                'root' => 'array',
                'document' => 'array',
                'array' => 'array',
            ],
        ]);
        $this->db = $env->mongodbDbName !== ''
            ? $this->client->selectDatabase($env->mongodbDbName)
            : $this->client->selectDatabase($this->databaseFromUri($env->mongodbUri));
    }

    public function ping(): bool
    {
        try {
            $this->db->command(['ping' => 1]);
            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    public function collection(string $logical): Collection
    {
        return $this->db->selectCollection(Collections::name($logical), [
            'typeMap' => [
                'root' => 'array',
                'document' => 'array',
                'array' => 'array',
            ],
        ]);
    }

    public function find(string $logical, array $filter = [], array $options = []): array
    {
        $options['typeMap'] = [
            'root' => 'array',
            'document' => 'array',
            'array' => 'array',
        ];
        $docs = $this->collection($logical)->find($filter, $options)->toArray();
        return array_map(fn ($doc) => $this->normalize($doc), $docs);
    }

    public function findOne(string $logical, array $filter = [], array $options = []): ?array
    {
        $options['typeMap'] = [
            'root' => 'array',
            'document' => 'array',
            'array' => 'array',
        ];
        $doc = $this->collection($logical)->findOne($filter, $options);
        return is_array($doc) ? $this->normalize($doc) : null;
    }

    public function insert(string $logical, array $doc): array
    {
        [$created, $updated, $version] = Collections::timestamps($logical);
        $fields = [$created];
        if ($updated !== null) {
            $fields[] = $updated;
        }
        $doc = Doc::stamp($doc, $fields, $version);
        $result = $this->collection($logical)->insertOne($doc);
        $doc['_id'] = $result->getInsertedId();
        return $doc;
    }

    public function updateOne(string $logical, array $filter, array $set, array $extra = []): int
    {
        $update = $extra;
        [, $updated] = Collections::timestamps($logical);
        if ($updated !== null) {
            $set[$updated] = Doc::date();
        }
        if ($set !== []) {
            $update['$set'] = array_merge($update['$set'] ?? [], $set);
        }
        $result = $this->collection($logical)->updateOne($filter, $update);
        return $result->getModifiedCount() + $result->getUpsertedCount();
    }

    public function replaceFields(string $logical, array $filter, array $set): ?array
    {
        [, $updated] = Collections::timestamps($logical);
        if ($updated !== null) {
            $set[$updated] = Doc::date();
        }
        $doc = $this->collection($logical)->findOneAndUpdate(
            $filter,
            ['$set' => $set],
            [
                'returnDocument' => FindOneAndUpdate::RETURN_DOCUMENT_AFTER,
                'typeMap' => [
                    'root' => 'array',
                    'document' => 'array',
                    'array' => 'array',
                ],
            ],
        );
        return is_array($doc) ? $this->normalize($doc) : null;
    }

    public function deleteOne(string $logical, array $filter): void
    {
        $this->collection($logical)->deleteOne($filter);
    }

    public function deleteMany(string $logical, array $filter): void
    {
        $this->collection($logical)->deleteMany($filter);
    }

    public function count(string $logical, array $filter = []): int
    {
        return $this->collection($logical)->countDocuments($filter);
    }

    public function aggregate(string $logical, array $pipeline): array
    {
        $rows = $this->collection($logical)->aggregate($pipeline, [
            'typeMap' => [
                'root' => 'array',
                'document' => 'array',
                'array' => 'array',
            ],
        ])->toArray();
        return array_map(fn ($row) => $this->normalize($row), $rows);
    }

    public function exists(string $logical, array $filter): bool
    {
        return $this->findOne($logical, $filter, ['projection' => ['_id' => 1]]) !== null;
    }

    /** @param list<string> $fields */
    public function populate(array $docs, string $field, string $logical, array $fields): array
    {
        $ids = [];
        foreach ($docs as $doc) {
            $id = Doc::oid($doc[$field] ?? null);
            if ($id !== null) {
                $ids[(string) $id] = $id;
            }
        }
        if ($ids === []) {
            return $docs;
        }
        $projection = ['_id' => 1];
        foreach ($fields as $name) {
            $projection[$name] = 1;
        }
        $related = $this->find($logical, ['_id' => ['$in' => array_values($ids)]], ['projection' => $projection]);
        $map = [];
        foreach ($related as $item) {
            $subset = ['_id' => $item['_id']];
            foreach ($fields as $name) {
                $subset[$name] = $item[$name] ?? null;
            }
            $map[(string) $item['_id']] = $subset;
        }
        foreach ($docs as &$doc) {
            $key = Doc::idString($doc[$field] ?? null);
            if ($key !== null && isset($map[$key])) {
                $doc[$field] = $map[$key];
            }
        }
        unset($doc);
        return $docs;
    }

    public function populateOne(?array $doc, string $field, string $logical, array $fields): ?array
    {
        if ($doc === null) {
            return null;
        }
        return $this->populate([$doc], $field, $logical, $fields)[0];
    }

    private function normalize(mixed $value): mixed
    {
        if ($value instanceof BSONDocument || $value instanceof BSONArray) {
            $value = $value->getArrayCopy();
        }
        if (!is_array($value)) {
            return $value;
        }
        $out = [];
        foreach ($value as $key => $item) {
            $out[$key] = $this->normalize($item);
        }
        return $out;
    }

    private function databaseFromUri(string $uri): string
    {
        $path = parse_url($uri, PHP_URL_PATH);
        $name = is_string($path) ? trim($path, '/') : '';
        return $name !== '' ? $name : 'harbor_homes_crm';
    }
}
