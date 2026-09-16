<?php

namespace App\Erp\Support;

final class Decimal
{
    public static function normalize(string $value, int $scale = 4): string
    {
        $value = trim($value);
        if ($value === '' || ! is_numeric($value)) {
            throw new \InvalidArgumentException('Invalid decimal');
        }

        if (function_exists('bcadd')) {
            return bcadd($value, '0', $scale);
        }

        return number_format((float) $value, $scale, '.', '');
    }

    public static function mul(string $a, string $b, int $scale = 4): string
    {
        $a = self::normalize($a, $scale);
        $b = self::normalize($b, $scale);

        if (function_exists('bcmul')) {
            return bcmul($a, $b, $scale);
        }

        return number_format((float) $a * (float) $b, $scale, '.', '');
    }

    public static function add(string $a, string $b, int $scale = 4): string
    {
        $a = self::normalize($a, $scale);
        $b = self::normalize($b, $scale);

        if (function_exists('bcadd')) {
            return bcadd($a, $b, $scale);
        }

        return number_format((float) $a + (float) $b, $scale, '.', '');
    }

    public static function equals(string $a, string $b, int $scale = 4): bool
    {
        return self::normalize($a, $scale) === self::normalize($b, $scale);
    }

    /**
     * Raod is numeric(12,4): at most 8 integral and 4 fractional digits.
     */
    public static function assertRaod(string $quantity): string
    {
        $normalized = self::normalize($quantity, 4);

        if (! preg_match('/^-?\d{1,8}(?:\.\d{1,4})?$/', $normalized)) {
            throw new \InvalidArgumentException('Raod overflow');
        }

        $parts = explode('.', ltrim($normalized, '-'), 2);
        if (strlen($parts[0]) > 8) {
            throw new \InvalidArgumentException('Raod overflow');
        }

        return $normalized;
    }
}
