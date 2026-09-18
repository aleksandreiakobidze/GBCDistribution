<?php

namespace Tests\Unit;

use App\Erp\Fmg\FmgNvarchar;
use PHPUnit\Framework\TestCase;

class FmgNvarcharTest extends TestCase
{
    public function test_like_contains_keeps_wildcards_in_sql(): void
    {
        $sql = FmgNvarchar::likeContains('o.Org', 'ab');

        $this->assertStringContainsString("o.Org LIKE N'%' + CONVERT(NVARCHAR(400), CONVERT(VARBINARY(MAX), '0x61006200', 1)) + N'%'", $sql);
    }

    public function test_encode_hex_roundtrips_georgian(): void
    {
        $hex = FmgNvarchar::encodeHex('ნოდარი');

        $this->assertSame('ნოდარი', FmgNvarchar::decode($hex));
        $this->assertStringStartsWith('0x', $hex);
    }
}
