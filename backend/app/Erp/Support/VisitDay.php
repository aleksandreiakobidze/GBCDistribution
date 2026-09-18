<?php

namespace App\Erp\Support;

use App\Erp\Dto\VisitSchedule;
use Carbon\Carbon;
use DateTimeInterface;

final class VisitDay
{
    /** @var list<string> */
    public const FLAGS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    public static function normalize(?string $day): string
    {
        return $day === 'today' ? 'today' : 'all';
    }

    /**
     * FMG OrgGvariView weekday flag (MON–SUN) for Asia/Tbilisi unless $now is given.
     */
    public static function fmgFlag(?DateTimeInterface $now = null): string
    {
        $tz = (string) config('erp.timezone', 'Asia/Tbilisi');
        $dt = $now === null
            ? Carbon::now($tz)
            : Carbon::parse($now)->timezone($tz);

        return match ($dt->isoWeekday()) {
            1 => 'MON',
            2 => 'TUE',
            3 => 'WED',
            4 => 'THU',
            5 => 'FRI',
            6 => 'SAT',
            default => 'SUN',
        };
    }

    public static function visitsOn(VisitSchedule $schedule, string $flag): bool
    {
        return match ($flag) {
            'MON' => $schedule->mon,
            'TUE' => $schedule->tue,
            'WED' => $schedule->wed,
            'THU' => $schedule->thu,
            'FRI' => $schedule->fri,
            'SAT' => $schedule->sat,
            'SUN' => $schedule->sun,
            default => false,
        };
    }

    public static function visitNum(VisitSchedule $schedule, string $flag): int
    {
        return match ($flag) {
            'MON' => $schedule->monNum,
            'TUE' => $schedule->tueNum,
            'WED' => $schedule->wedNum,
            'THU' => $schedule->thuNum,
            'FRI' => $schedule->friNum,
            'SAT' => $schedule->satNum,
            'SUN' => $schedule->sunNum,
            default => 0,
        };
    }

    /**
     * @param  array<string, mixed>  $schedule
     */
    public static function visitsOnArray(array $schedule, string $flag): bool
    {
        $value = $schedule[$flag] ?? false;

        return $value === true || $value === 1 || $value === '1';
    }

    /**
     * @param  array<string, mixed>  $schedule
     */
    public static function visitNumFromArray(array $schedule, string $flag): int
    {
        return (int) ($schedule[$flag.'Num'] ?? 0);
    }
}
