<?php

namespace Tests\Unit;

use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\ItemRecord;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\PackQuantity;
use PHPUnit\Framework\TestCase;

class PackQuantityTest extends TestCase
{
    public function test_one_pack_writes_compraod_pieces(): void
    {
        $resolved = PackQuantity::resolve('1', $this->item(compRaod: '24.0000', canHalf: true), $this->customer(true));

        $this->assertSame('1.0000', $resolved['packQuantity']);
        $this->assertSame('24.0000', $resolved['pieces']);
        $this->assertSame('24.0000', $resolved['compRaod']);
    }

    public function test_half_pack_is_half_compraod(): void
    {
        $resolved = PackQuantity::resolve('0.5', $this->item(compRaod: '24.0000', canHalf: true), $this->customer(true));

        $this->assertSame('0.5000', $resolved['packQuantity']);
        $this->assertSame('12.0000', $resolved['pieces']);
    }

    public function test_half_pack_requires_both_flags(): void
    {
        try {
            PackQuantity::resolve('0.5', $this->item(compRaod: '24.0000', canHalf: true), $this->customer(false));
            $this->fail('Expected HALF_PACK_NOT_ALLOWED');
        } catch (ErpException $e) {
            $this->assertSame('HALF_PACK_NOT_ALLOWED', $e->errorCode);
        }

        try {
            PackQuantity::resolve('0.5', $this->item(compRaod: '24.0000', canHalf: false), $this->customer(true));
            $this->fail('Expected HALF_PACK_NOT_ALLOWED');
        } catch (ErpException $e) {
            $this->assertSame('HALF_PACK_NOT_ALLOWED', $e->errorCode);
        }
    }

    public function test_fraction_other_than_half_is_rejected(): void
    {
        $this->expectException(ErpException::class);
        PackQuantity::resolve('0.3', $this->item(compRaod: '24.0000', canHalf: true), $this->customer(true));
    }

    private function item(string $compRaod, bool $canHalf): ItemRecord
    {
        return new ItemRecord(
            itemId: '0001',
            name: 'Water',
            unit: 'ცალი',
            unitName: 'ცალი',
            prodCode: 'W001',
            category: 'Drinks',
            prodS: 'Drinks',
            type: 'Beverages',
            group: 'Water',
            unitPrice: '1.5000',
            priceState: 'list',
            priceError: null,
            active: true,
            showInPocket: true,
            compRaod: $compRaod,
            canRealHalfComp: $canHalf,
        );
    }

    private function customer(bool $canHalf): CustomerRecord
    {
        return new CustomerRecord(
            customerId: '1001',
            name: 'Org A',
            orgCode: '1001',
            address: null,
            phone: null,
            city: null,
            priceGroup: 1,
            sagad: null,
            idQseli: 1,
            qseli: null,
            idOrgT: 1,
            orgT: 'Retail',
            idReg: 1,
            idOrgCategory: 1,
            orgCategory: null,
            idOrgCompanyCategory: 1,
            latitude: null,
            longitude: null,
            useProdList: false,
            orgShowPocket: true,
            active: true,
            canRealHalfComp: $canHalf,
        );
    }
}
