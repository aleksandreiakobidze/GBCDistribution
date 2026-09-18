<?php

namespace Tests\Unit;

use App\Erp\Dto\CustomerRecord;
use App\Erp\Support\PriceGroupMapping;
use App\Erp\Support\PromotionPresenter;
use App\Erp\Support\PromotionScope;
use PHPUnit\Framework\TestCase;

class PromotionScopeTest extends TestCase
{
    public function test_empty_filters_match_everyone(): void
    {
        $this->assertTrue(PromotionScope::matches([
            'IdActions' => '1',
            'IdActionsT' => 2,
        ], $this->customer(), new \DateTimeImmutable('2026-09-17')));
    }

    public function test_orgt_mismatch_does_not_match(): void
    {
        $this->assertFalse(PromotionScope::matches([
            'IdActionsT' => 2,
            'IdOrgT' => [99],
        ], $this->customer(), new \DateTimeImmutable('2026-09-17')));
    }

    public function test_orgt_hit_matches(): void
    {
        $this->assertTrue(PromotionScope::matches([
            'IdActionsT' => 2,
            'IdOrgT' => [1, 2],
        ], $this->customer(), new \DateTimeImmutable('2026-09-17')));
    }

    public function test_sagad_exclude_blocks(): void
    {
        $this->assertFalse(PromotionScope::matches([
            'IdActionsT' => 2,
            'Sagad' => [['Sagad' => '123456789', 'Exclude' => 1]],
        ], $this->customer(), new \DateTimeImmutable('2026-09-17')));
    }

    public function test_null_action_is_skipped(): void
    {
        $this->assertFalse(PromotionScope::matches([
            'IdActionsT' => -1,
        ], $this->customer(), new \DateTimeImmutable('2026-09-17')));
    }

    public function test_fg_is_string_compare(): void
    {
        $this->assertTrue(PromotionScope::matchesFg(['1'], 1));
        $this->assertFalse(PromotionScope::matchesFg(['01'], 1));
        $this->assertTrue(PromotionScope::matchesFg([], 1));
    }

    public function test_percent_of_list_subtracts_from_list(): void
    {
        $this->assertSame('1.0500', PromotionPresenter::percentOfList('1.5000', '30'));
        $this->assertSame('0.7500', PromotionPresenter::percentOfList('1.5000', '0.5'));
        $this->assertSame('1.1008', PromotionPresenter::percentOfList('1.2800', '14'));
        $this->assertNull(PromotionPresenter::percentOfList('1.5000', '0'));
        $this->assertNull(PromotionPresenter::percentOfList('1.5000', '100'));
        $this->assertNull(PromotionPresenter::percentOfList('1.5000', '150'));
    }

    public function test_fixed_price_and_skip_null_type(): void
    {
        $presenter = new PromotionPresenter(new PriceGroupMapping);
        $fixed = $presenter->present($this->customer(), [
            'IdActions' => 'A1',
            'Actions' => 'Fix',
            'ActionsT' => 'fixed',
            'IdActionsT' => 2,
            'ActionsRaod1' => 6,
        ], [
            ['IdProd' => '0001', 'Prod' => 'Water 1.5L', 'ActionsFasi' => '1.2000'],
        ]);
        $this->assertSame('indicative', $fixed['state']);
        $this->assertFalse($fixed['appliesToAllProducts']);
        $this->assertSame('1.2000', $fixed['products'][0]['promoPrice']);
        $this->assertSame('fixed', $fixed['products'][0]['kind']);
        $this->assertSame(6, $fixed['minQty']);

        $this->assertNull($presenter->present($this->customer(), ['IdActionsT' => -1], []));

        $all = $presenter->present($this->customer(), [
            'IdActions' => 'A2',
            'IdActionsT' => 3,
            'ActionsPercent' => '30',
            'FromStandardFasi' => 0,
        ], []);
        $this->assertTrue($all['appliesToAllProducts']);
        $this->assertSame([], $all['products']);
    }

    public function test_qty_window_is_type_specific(): void
    {
        $t3 = PromotionPresenter::qtyWindow([
            'IdActionsT' => 3,
            'ActionsRaod3' => 6,
            'ActionsRaod1' => 99,
            'ActionsRaod2' => 500,
        ]);
        $this->assertSame(6, $t3['min']);
        $this->assertNull($t3['max']);

        $t2 = PromotionPresenter::qtyWindow([
            'IdActionsT' => 2,
            'ActionsRaod1' => 55,
            'ActionsRaod2' => 30000,
            'ActionsRaod3' => 99,
        ]);
        $this->assertSame(55, $t2['min']);
        $this->assertSame(30000, $t2['max']);

        $noCap = PromotionPresenter::qtyWindow([
            'IdActionsT' => 2,
            'ActionsRaod1' => 5,
            'ActionsRaod2' => 0,
        ]);
        $this->assertSame(5, $noCap['min']);
        $this->assertNull($noCap['max']);

        // Live FMG cross-populates the columns; the strict split leaves these ungated.
        $t3OnlyRaod1 = PromotionPresenter::qtyWindow(['IdActionsT' => 3, 'ActionsRaod1' => 450]);
        $this->assertSame(0, $t3OnlyRaod1['min']);
        $t2OnlyRaod3 = PromotionPresenter::qtyWindow(['IdActionsT' => 2, 'ActionsRaod3' => 760]);
        $this->assertSame(0, $t2OnlyRaod3['min']);

        $gift = PromotionPresenter::qtyWindow(['IdActionsT' => 1, 'ActionsRaod3' => 10]);
        $this->assertSame(0, $gift['min']);
        $this->assertNull($gift['max']);
    }

    public function test_present_exposes_qty_window(): void
    {
        $presenter = new PromotionPresenter(new PriceGroupMapping);
        $row = $presenter->present($this->customer(), [
            'IdActions' => 'A4',
            'IdActionsT' => 2,
            'ActionsRaod1' => 55,
            'ActionsRaod2' => 200,
        ], [
            ['IdProd' => '0001', 'Prod' => 'Wine 0.35L', 'ActionsFasi' => '2.0000'],
        ]);
        $this->assertSame(55, $row['minQty']);
        $this->assertSame(200, $row['maxQty']);
    }

    public function test_zero_fixed_price_is_not_presented(): void
    {
        $presenter = new PromotionPresenter(new PriceGroupMapping);
        $row = $presenter->present($this->customer(), [
            'IdActions' => 'A5',
            'IdActionsT' => 2,
        ], [
            ['IdProd' => '0001', 'Prod' => 'Water', 'ActionsFasi' => '.0000'],
        ]);
        $this->assertNull($row['products'][0]['promoPrice']);
    }

    public function test_percent_from_standard_unknown_orgt_has_no_gel(): void
    {
        $presenter = new PromotionPresenter(new PriceGroupMapping);
        $row = $presenter->present($this->customer(idOrgT: 1), [
            'IdActions' => 'A3',
            'IdActionsT' => 3,
            'FromStandardFasi' => 1,
            'ActionsPercent' => '30',
        ], [
            ['IdProd' => '0001', 'Prod' => 'Water', 'Fasi1' => '1.5000'],
        ]);
        $this->assertNull($row['products'][0]['promoPrice']);
        $this->assertNull($row['products'][0]['basis']);
    }

    public function test_percent_from_standard_orgt_102_uses_fasi1(): void
    {
        $presenter = new PromotionPresenter(new PriceGroupMapping);
        $row = $presenter->present($this->customer(idOrgT: 102), [
            'IdActions' => 'A4',
            'IdActionsT' => 3,
            'FromStandardFasi' => 1,
            'ActionsPercent' => '30',
        ], [
            ['IdProd' => '0001', 'Prod' => 'Water', 'Fasi1' => '1.5000'],
        ]);
        $this->assertSame('Fasi1', $row['products'][0]['basis']);
        $this->assertSame('1.0500', $row['products'][0]['promoPrice']);
    }

    private function customer(int $idOrgT = 1): CustomerRecord
    {
        return new CustomerRecord(
            customerId: '1001',
            name: 'Org A',
            orgCode: 'C1001',
            address: null,
            phone: null,
            city: null,
            priceGroup: 1,
            sagad: '123456789',
            idQseli: 1,
            qseli: 'West',
            idOrgT: $idOrgT,
            orgT: $idOrgT === 102 ? 'Horeca' : 'Retail',
            idReg: 1,
            idOrgCategory: 1,
            orgCategory: 'Standard',
            latitude: null,
            longitude: null,
            useProdList: false,
            orgShowPocket: true,
            active: true,
        );
    }
}
