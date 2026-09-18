<?php

namespace App\Erp\Support;

final class GeoPoint
{
    public static function isPlottable(?string $latitude, ?string $longitude): bool
    {
        if ($latitude === null || $longitude === null || $latitude === '' || $longitude === '') {
            return false;
        }

        if (! is_numeric($latitude) || ! is_numeric($longitude)) {
            return false;
        }

        $lat = (float) $latitude;
        $lon = (float) $longitude;

        return $lat != 0.0 && $lon != 0.0;
    }
}
