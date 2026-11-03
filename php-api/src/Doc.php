<?php

declare(strict_types=1);

namespace YahooCrm;

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\Regex;
use MongoDB\BSON\UTCDateTime;
use MongoDB\Driver\Exception\BulkWriteException;
use Throwable;

final class Doc
{
    public static function oid(mixed $value): ?ObjectId
    {
        if ($value instanceof ObjectId) {
            return $value;
        }
        if (is_array($value) && isset($value['_id'])) {
            return self::oid($value['_id']);
        }
        if (!is_string($value) || !preg_match('/^[a-f0-9]{24}$/i', $value)) {
            return null;
        }
        try {
            return new ObjectId($value);
        } catch (Throwable) {
            return null;
        }
    }

    public static function isOid(mixed $value): bool
    {
        return self::oid($value) !== null;
    }

    public static function idString(mixed $value): ?string
    {
        if ($value instanceof ObjectId) {
            return (string) $value;
        }
        if (is_array($value)) {
            if (isset($value['_id'])) {
                return self::idString($value['_id']);
            }
            if (isset($value['$oid']) && is_string($value['$oid'])) {
                return $value['$oid'];
            }
        }
        if (is_string($value) && preg_match('/^[a-f0-9]{24}$/i', $value)) {
            return $value;
        }
        return null;
    }

    public static function date(mixed $value = null): UTCDateTime
    {
        if ($value instanceof UTCDateTime) {
            return $value;
        }
        if ($value instanceof \DateTimeInterface) {
            return new UTCDateTime((int) $value->format('Uv'));
        }
        if (is_string($value) && $value !== '') {
            $parsed = self::parseDate($value);
            if ($parsed !== null) {
                return new UTCDateTime((int) $parsed->format('Uv'));
            }
        }
        return new UTCDateTime();
    }

    public static function parseDate(mixed $value): ?\DateTimeImmutable
    {
        if ($value instanceof UTCDateTime) {
            return \DateTimeImmutable::createFromMutable($value->toDateTime())->setTimezone(new \DateTimeZone('UTC'));
        }
        if ($value instanceof \DateTimeInterface) {
            return \DateTimeImmutable::createFromInterface($value)->setTimezone(new \DateTimeZone('UTC'));
        }
        if (!is_string($value) || trim($value) === '') {
            return null;
        }
        $text = trim($value);
        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $text)) {
            $text = str_replace(' ', 'T', $text) . 'Z';
        }
        try {
            return (new \DateTimeImmutable($text))->setTimezone(new \DateTimeZone('UTC'));
        } catch (Throwable) {
            return null;
        }
    }

    public static function iso(mixed $value): ?string
    {
        $date = self::parseDate($value);
        return $date?->format('Y-m-d\TH:i:s.v\Z');
    }

    public static function sql(mixed $value): ?string
    {
        $date = self::parseDate($value);
        return $date?->format('Y-m-d H:i:s');
    }

    public static function regex(string $pattern, string $flags = 'i'): Regex
    {
        return new Regex($pattern, $flags);
    }

    public static function escapeRegex(string $value): string
    {
        return preg_quote($value, '/');
    }

    public static function duplicate(Throwable $error): bool
    {
        if ($error instanceof BulkWriteException) {
            $result = $error->getWriteResult();
            foreach ($result->getWriteErrors() as $writeError) {
                if ($writeError->getCode() === 11000) {
                    return true;
                }
            }
        }
        return $error->getCode() === 11000;
    }

    public static function stamp(array $doc, array $fields, bool $version = true): array
    {
        $now = self::date();
        foreach ($fields as $field) {
            if (!array_key_exists($field, $doc)) {
                $doc[$field] = $now;
            }
        }
        if ($version && !array_key_exists('__v', $doc)) {
            $doc['__v'] = 0;
        }
        return $doc;
    }

    /**
     * Convert BSON values the way Express JSON encodes Mongoose documents.
     */
    public static function jsonable(mixed $value): mixed
    {
        if ($value instanceof ObjectId) {
            return (string) $value;
        }
        if ($value instanceof UTCDateTime || $value instanceof \DateTimeInterface) {
            return self::iso($value);
        }
        if ($value instanceof Regex) {
            return (string) $value;
        }
        if (is_array($value)) {
            $out = [];
            foreach ($value as $key => $item) {
                $out[$key] = self::jsonable($item);
            }
            return $out;
        }
        return $value;
    }
}
