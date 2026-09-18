<?php

namespace App\Erp\Fmg;

/**
 * Native Client 11 via pdo_odbc converts nvarchar to the Windows ANSI code page,
 * which turns Georgian into "?". Pull UTF-16LE as hex and decode in PHP.
 */
final class FmgNvarchar
{
    public static function col(string $expression, string $alias): string
    {
        return 'CONVERT(VARCHAR(MAX), CAST('.$expression.' AS VARBINARY(MAX)), 1) AS '.$alias;
    }

    public static function decode(mixed $value): string
    {
        $decoded = self::decodeNullable($value);

        return $decoded ?? '';
    }

    public static function decodeNullable(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $hex = trim((string) $value);
        if ($hex === '') {
            return '';
        }

        if (str_starts_with($hex, '0x') || str_starts_with($hex, '0X')) {
            $hex = substr($hex, 2);
        }

        if ($hex === '' || strlen($hex) % 2 === 1 || ! ctype_xdigit($hex)) {
            return (string) $value;
        }

        $raw = hex2bin($hex);
        if ($raw === false) {
            return (string) $value;
        }

        $utf8 = mb_convert_encoding($raw, 'UTF-8', 'UTF-16LE');
        if (! is_string($utf8)) {
            return (string) $value;
        }

        return rtrim($utf8, "\0");
    }

    public static function encodeHex(string $utf8): string
    {
        $raw = mb_convert_encoding($utf8, 'UTF-16LE', 'UTF-8');

        return '0x'.strtoupper(bin2hex($raw));
    }

    /**
     * LIKE that survives Native Client 11's ANSI conversion of bound nvarchar.
     * The search text is inlined as a validated UTF-16LE hex literal so CONVERT
     * runs in SQL Server, not on a bound parameter the driver mangles.
     */
    public static function likeContains(string $expression, string $utf8): string
    {
        $hex = self::encodeHex($utf8);
        if ($hex === '0x' || ! preg_match('/^0x[0-9A-F]+$/', $hex)) {
            return '1 = 0';
        }

        return $expression." LIKE N'%' + CONVERT(NVARCHAR(400), CONVERT(VARBINARY(MAX), '".$hex."', 1)) + N'%'";
    }
}
