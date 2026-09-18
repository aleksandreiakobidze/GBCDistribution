<?php

namespace Tests\Unit;

use App\Erp\Exceptions\ErpException;
use App\Erp\Support\Decimal;
use App\Erp\Support\PriceGroupMapping;
use PHPUnit\Framework\TestCase;

class PriceGroupMappingTest extends TestCase
{
    public function test_valid_groups_map_to_fasi_columns(): void
    {
        $mapping = new PriceGroupMapping;

        $this->assertSame('Fasi1', $mapping->columnFor(1));
        $this->assertSame('Fasi2', $mapping->columnFor(2));
        $this->assertSame('Fasi60', $mapping->columnFor(60));
    }

    public function test_invalid_group_does_not_fall_back(): void
    {
        $mapping = new PriceGroupMapping;
        $this->expectException(\InvalidArgumentException::class);
        $mapping->columnFor(0);
    }

    public function test_null_price_does_not_become_zero(): void
    {
        $mapping = new PriceGroupMapping;
        $this->expectException(\InvalidArgumentException::class);
        $mapping->unitPriceFromProduct(['Fasi1' => null], 1);
    }

    public function test_sql_case_does_not_interpolate_fg_as_identifier(): void
    {
        $sql = (new PriceGroupMapping)->sqlCaseExpression('p', '?');
        $this->assertStringContainsString('WHEN 1 THEN p.Fasi1', $sql);
        $this->assertStringNotContainsString('Fasi?', $sql);
    }

    public function test_raod_bounds(): void
    {
        $this->assertSame('12.0000', Decimal::assertRaod('12'));
        $this->assertSame('12.5000', Decimal::assertRaod('12.5'));
        $this->expectException(\InvalidArgumentException::class);
        Decimal::assertRaod('123456789.0000');
    }

    public function test_id_prod_leading_zeros_are_strings(): void
    {
        $this->assertSame('0001', (string) '0001');
        $this->assertNotSame('1', '0001');
    }
}
