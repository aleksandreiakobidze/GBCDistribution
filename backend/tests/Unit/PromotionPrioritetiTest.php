<?php

namespace Tests\Unit;

use App\Erp\Support\PromotionPrioriteti;
use PHPUnit\Framework\TestCase;

class PromotionPrioritetiTest extends TestCase
{
    public function test_lower_prioriteti_wins_per_product(): void
    {
        $actions = [
            [
                'header' => ['IdActions' => 'A', 'Prioriteti' => 10, 'IdActionsT' => 2],
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '9']],
            ],
            [
                'header' => ['IdActions' => 'B', 'Prioriteti' => 2, 'IdActionsT' => 2],
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '1']],
            ],
        ];

        $winners = PromotionPrioriteti::winnersForDisplay($actions);
        $this->assertCount(1, $winners);
        $this->assertSame('B', $winners[0]['header']['IdActions']);
        $this->assertSame('1', $winners[0]['products'][0]['ActionsFasi']);
    }

    public function test_apply_all_only_keeps_lowest_prioriteti(): void
    {
        $actions = [
            [
                'header' => ['IdActions' => 'X', 'Prioriteti' => 5, 'IdActionsT' => 3],
                'products' => [],
            ],
            [
                'header' => ['IdActions' => 'Y', 'Prioriteti' => 1, 'IdActionsT' => 3],
                'products' => [],
            ],
        ];

        $winners = PromotionPrioriteti::winnersForDisplay($actions);
        $this->assertCount(1, $winners);
        $this->assertSame('Y', $winners[0]['header']['IdActions']);
        $this->assertSame([], $winners[0]['products']);
    }

    public function test_each_qty_tier_survives_display(): void
    {
        $actions = [
            [
                'header' => ['IdActions' => 'SMALL', 'Prioriteti' => 50, 'IdActionsT' => 2, 'ActionsRaod1' => 5],
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '1.0000']],
            ],
            [
                'header' => ['IdActions' => 'BULK', 'Prioriteti' => 1, 'IdActionsT' => 2, 'ActionsRaod1' => 100],
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '0.8600']],
            ],
        ];

        $winners = PromotionPrioriteti::winnersForDisplay($actions);
        $this->assertCount(2, $winners);
        $this->assertSame(['BULK', 'SMALL'], array_map(
            fn (array $w): string => $w['header']['IdActions'],
            $winners,
        ));
    }

    public function test_qty_eligibility_precedes_prioriteti(): void
    {
        $actions = [
            [
                'header' => ['IdActions' => 'SMALL', 'Prioriteti' => 50, 'IdActionsT' => 2, 'ActionsRaod1' => 5],
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '1.0000']],
            ],
            [
                'header' => ['IdActions' => 'BULK', 'Prioriteti' => 1, 'IdActionsT' => 2, 'ActionsRaod1' => 100],
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '0.8600']],
            ],
        ];

        $atTen = PromotionPrioriteti::winnerForItem($actions, '0001', 10.0);
        $this->assertSame('SMALL', $atTen['header']['IdActions']);

        $atHundred = PromotionPrioriteti::winnerForItem($actions, '0001', 100.0);
        $this->assertSame('BULK', $atHundred['header']['IdActions']);

        $atOne = PromotionPrioriteti::winnerForItem($actions, '0001', 1.0);
        $this->assertNull($atOne);
    }

    public function test_raod2_bounds_t2_eligibility(): void
    {
        $capped = [
            'header' => ['IdActions' => 'CAP', 'Prioriteti' => 1, 'IdActionsT' => 2, 'ActionsRaod1' => 5, 'ActionsRaod2' => 10],
            'products' => [['IdProd' => '0001']],
        ];

        $this->assertTrue(PromotionPrioriteti::qtyEligible($capped, 10.0));
        $this->assertFalse(PromotionPrioriteti::qtyEligible($capped, 11.0));

        $uncapped = $capped;
        $uncapped['header']['ActionsRaod2'] = 0;
        $this->assertTrue(PromotionPrioriteti::qtyEligible($uncapped, 999.0));
    }

    public function test_id_actions_tie_break(): void
    {
        $actions = [
            [
                'header' => ['IdActions' => 'B2', 'Prioriteti' => 1, 'IdActionsT' => 2],
                'products' => [['IdProd' => '0001']],
            ],
            [
                'header' => ['IdActions' => 'A1', 'Prioriteti' => 1, 'IdActionsT' => 2],
                'products' => [['IdProd' => '0001']],
            ],
        ];

        $winner = PromotionPrioriteti::winnerForItem($actions, '0001');
        $this->assertSame('A1', $winner['header']['IdActions']);
    }
}
