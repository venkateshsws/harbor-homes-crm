<?php

declare(strict_types=1);

namespace YahooCrm;

final class Clock
{
    public static function workDate(\DateTimeInterface $date, string $timezone): string
    {
        $zone = new \DateTimeZone($timezone !== '' ? $timezone : 'Asia/Kolkata');
        return \DateTimeImmutable::createFromInterface($date)->setTimezone($zone)->format('Y-m-d');
    }

    public static function zonedParts(\DateTimeInterface $date, string $timezone): array
    {
        $zone = new \DateTimeZone($timezone);
        $local = \DateTimeImmutable::createFromInterface($date)->setTimezone($zone);
        return [
            'year' => $local->format('Y'),
            'month' => $local->format('m'),
            'day' => $local->format('d'),
            'hour' => $local->format('H'),
            'minute' => $local->format('i'),
            'second' => $local->format('s'),
        ];
    }

    public static function dateKey(\DateTimeInterface $date, string $timezone): string
    {
        $parts = self::zonedParts($date, $timezone);
        return $parts['year'] . '-' . $parts['month'] . '-' . $parts['day'];
    }

    public static function addDays(string $dateKey, int $amount): string
    {
        [$year, $month, $day] = array_map('intval', explode('-', $dateKey));
        return gmdate('Y-m-d', gmmktime(0, 0, 0, $month, $day + $amount, $year));
    }

    public static function zonedMidnightToUtc(string $dateKey, string $timezone): \DateTimeImmutable
    {
        [$year, $month, $day] = array_map('intval', explode('-', $dateKey));
        $guess = new \DateTimeImmutable(sprintf('%04d-%02d-%02dT00:00:00+00:00', $year, $month, $day));
        $parts = self::zonedParts($guess, $timezone);
        $represented = gmmktime(
            (int) $parts['hour'],
            (int) $parts['minute'],
            (int) $parts['second'],
            (int) $parts['month'],
            (int) $parts['day'],
            (int) $parts['year'],
        );
        $offset = $represented - $guess->getTimestamp();
        return $guess->setTimestamp($guess->getTimestamp() - $offset);
    }

    public static function monthBounds(?string $month): array
    {
        $value = is_string($month) && preg_match('/^\d{4}-\d{2}$/', $month) ? $month : gmdate('Y-m');
        [$year, $monthNumber] = array_map('intval', explode('-', $value));
        if ($monthNumber < 1 || $monthNumber > 12) {
            throw new HttpException(400, 'Invalid month. Use YYYY-MM.');
        }
        $nextYear = $monthNumber === 12 ? $year + 1 : $year;
        $nextMonth = $monthNumber === 12 ? 1 : $monthNumber + 1;
        return [
            'value' => $value,
            'start' => sprintf('%04d-%02d-01', $year, $monthNumber),
            'end' => sprintf('%04d-%02d-01', $nextYear, $nextMonth),
        ];
    }
}
