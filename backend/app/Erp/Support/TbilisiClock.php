<?php

namespace App\Erp\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;

final class TbilisiClock
{
    /**
     * Visit times are stored as Asia/Tbilisi wall-clock values.
     * Reattach that offset so clients do not shift them by four hours.
     */
    public static function iso(?CarbonInterface $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return Carbon::parse($value->format('Y-m-d H:i:s'), 'Asia/Tbilisi')->toIso8601String();
    }
}
