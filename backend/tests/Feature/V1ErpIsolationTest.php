<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Erp\Fake\FakeErpState;
use App\Models\ErpOrderReceipt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class V1ErpIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        FakeErpState::seedDefault();
    }

    public function test_health_is_public(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('data.provider', 'fake');
    }

    public function test_unmapped_identity_is_forbidden(): void
    {
        $user = User::factory()->create(['role' => UserRole::SalesRep, 'id_gvari' => null]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/customers')
            ->assertStatus(403)
            ->assertJsonPath('code', 'UNMAPPED_PRESELLER');
    }

    public function test_me_returns_unmapped_preseller_without_forbidding_session(): void
    {
        $user = User::factory()->create(['role' => UserRole::SalesRep, 'id_gvari' => null]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('data.presellerMapped', false)
            ->assertJsonPath('data.presellerId', null);
    }

    public function test_fmg_presellers_command_fails_when_sql_is_not_configured(): void
    {
        config([
            'database.connections.fmg.host' => '',
            'database.connections.fmg.database' => '',
        ]);

        $this->artisan('fmg:presellers')->assertFailed();
    }

    public function test_presellers_cannot_see_each_others_customers(): void
    {
        $nino = $this->preseller(11);
        $davit = $this->preseller(12);

        Sanctum::actingAs($nino);
        $ninoIds = collect($this->getJson('/api/v1/customers')->json('data.items'))->pluck('customerId')->all();
        $this->assertEqualsCanonicalizing(['1001', '1002', '3001'], $ninoIds);
        $this->assertCount(3, $ninoIds);

        Sanctum::actingAs($davit);
        $davitIds = collect($this->getJson('/api/v1/customers')->json('data.items'))->pluck('customerId')->all();
        $this->assertSame(['2001'], $davitIds);

        Sanctum::actingAs($nino);
        $this->getJson('/api/v1/customers/1001')
            ->assertOk()
            ->assertJsonPath('data.customerId', '1001')
            ->assertJsonPath('data.orgCode', '1001')
            ->assertJsonPath('data.idOrgT', 1)
            ->assertJsonPath('data.orgT', 'Retail')
            ->assertJsonPath('data.sagad', '123456789')
            ->assertJsonPath('data.idQseli', 1)
            ->assertJsonPath('data.qseli', 'West')
            ->assertJsonPath('data.idOrgCategory', 1)
            ->assertJsonPath('data.orgCategory', 'Standard')
            ->assertJsonPath('data.kegs.0.itemId', '1025')
            ->assertJsonPath('data.kegs.0.name', 'Keg 50L')
            ->assertJsonPath('data.kegs.0.quantity', '6.000')
            ->assertJsonPath('data.balance', '125.5000')
            ->assertJsonPath('data.canRealHalfComp', true);
        $this->getJson('/api/v1/customers?presellerId=12')->assertOk();
        $spoofed = collect($this->getJson('/api/v1/customers?presellerId=12')->json('data.items'))->pluck('customerId')->all();
        $this->assertEqualsCanonicalizing(['1001', '1002', '3001'], $spoofed);
    }

    public function test_duplicate_assignments_do_not_duplicate_customers(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $ids = collect($this->getJson('/api/v1/customers')->json('data.items'))->pluck('customerId');
        $this->assertSame(1, $ids->filter(fn ($id) => $id === '1001')->count());
    }

    public function test_customer_search_matches_name_and_id(): void
    {
        Sanctum::actingAs($this->preseller(11));

        $byName = collect($this->getJson('/api/v1/customers?day=all&search=Org%20A')->json('data.items'))
            ->pluck('customerId')->all();
        $this->assertSame(['1001'], $byName);

        $byId = collect($this->getJson('/api/v1/customers?day=all&search=1002')->json('data.items'))
            ->pluck('customerId')->all();
        $this->assertSame(['1002'], $byId);

        $this->getJson('/api/v1/customers?day=all&search=missing')
            ->assertOk()
            ->assertJsonPath('data.items', []);
    }

    public function test_org_show_pocket_zero_is_hidden_from_list(): void
    {
        Sanctum::actingAs($this->preseller(11));

        $ids = collect($this->getJson('/api/v1/customers')->json('data.items'))->pluck('customerId')->all();
        $this->assertNotContains('1005', $ids);

        $this->getJson('/api/v1/customers/1005')->assertStatus(404);
    }

    public function test_revoked_assignment_blocks_access(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $this->getJson('/api/v1/customers/1002')->assertOk();

        FakeErpState::$assignments = array_values(array_filter(
            FakeErpState::$assignments,
            fn ($row) => ! ((string) $row['IdOrg'] === '1002' && (int) $row['IdGvari'] === 11)
        ));

        $this->getJson('/api/v1/customers/1002')->assertStatus(404);
        $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1002',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertStatus(404);
    }

    public function test_fg_groups_select_distinct_fasi_prices(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $fg1 = $this->getJson('/api/v1/items/0001?customerId=1001')->json('data.unitPrice');
        $fg2 = $this->getJson('/api/v1/items/0001?customerId=1002')->json('data.unitPrice');
        $this->assertSame('1.5000', $fg1);
        $this->assertSame('2.5000', $fg2);

        $listed = collect($this->getJson('/api/v1/items?customerId=1001')->json('data.items'));
        $this->assertSame('1.5000', $listed->firstWhere('itemId', '0001')['unitPrice']);
        $this->assertSame('list', $listed->firstWhere('itemId', '0001')['priceState']);
    }

    public function test_fg_59_uses_fasi59(): void
    {
        FakeErpState::$customers[0]['FG'] = 59;
        FakeErpState::$products[0]['Fasi59'] = '8.2500';
        Sanctum::actingAs($this->preseller(11));

        $this->getJson('/api/v1/items/0001?customerId=1001')
            ->assertOk()
            ->assertJsonPath('data.unitPrice', '8.2500');

        $listed = collect($this->getJson('/api/v1/items?customerId=1001')->json('data.items'));
        $this->assertSame('8.2500', $listed->firstWhere('itemId', '0001')['unitPrice']);
    }

    public function test_null_and_invalid_price_groups_fail_closed(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $this->getJson('/api/v1/items/0003?customerId=1001')
            ->assertOk()
            ->assertJsonPath('data.unitPrice', null)
            ->assertJsonPath('data.priceError', 'PRICE_UNAVAILABLE');

        $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0003', 'quantity' => '1']],
        ])->assertStatus(422)->assertJsonPath('code', 'PRICE_UNAVAILABLE');
    }

    public function test_use_prod_list_does_not_open_unrestricted_catalog(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $this->getJson('/api/v1/items?customerId=3001')
            ->assertStatus(422)
            ->assertJsonPath('code', 'ASSORTMENT_UNRESOLVED');
    }

    public function test_item_ids_keep_leading_zeros(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $this->getJson('/api/v1/items/0001?customerId=1001')
            ->assertOk()
            ->assertJsonPath('data.itemId', '0001');
    }

    public function test_catalog_without_customer_omits_prices_and_hidden_items(): void
    {
        Sanctum::actingAs($this->preseller(11));

        $response = $this->getJson('/api/v1/items')->assertOk();
        $ids = collect($response->json('data.items'))->pluck('itemId')->all();
        $this->assertEqualsCanonicalizing(['0001', '0002', '0003'], $ids);
        foreach ($response->json('data.items') as $item) {
            $this->assertNull($item['unitPrice']);
            $this->assertSame('omitted', $item['priceState']);
            $this->assertSame('Beverages', $item['type']);
        }

        $this->getJson('/api/v1/items/0001')
            ->assertOk()
            ->assertJsonPath('data.unitPrice', null)
            ->assertJsonPath('data.priceState', 'omitted')
            ->assertJsonPath('data.group', 'Water');

        $this->getJson('/api/v1/items/0004')->assertStatus(404);

        $this->getJson('/api/v1/items/groups')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Beverages')
            ->assertJsonPath('data.0.count', 3)
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/v1/items/taxonomy')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Drinks')
            ->assertJsonPath('data.0.count', 3)
            ->assertJsonPath('data.0.types.0.name', 'Beverages')
            ->assertJsonPath('data.0.types.0.count', 3);

        $this->getJson('/api/v1/items?prodS=Drinks')
            ->assertOk()
            ->assertJsonCount(3, 'data.items');

        $this->getJson('/api/v1/items?customerId=1001&prodS=Drinks&prodT=Beverages')
            ->assertOk()
            ->assertJsonCount(3, 'data.items');

        $this->getJson('/api/v1/items?customerId=1001&prodS=Beer')
            ->assertOk()
            ->assertJsonCount(0, 'data.items');

        $this->getJson('/api/v1/items/0005')->assertStatus(404);
        $names = collect($response->json('data.items'))->pluck('name')->all();
        $this->assertSame(['Juice', 'Null price item', 'Water 1.5L'], $names);
    }

    public function test_quote_ignores_client_unit_prices(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $response = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '2', 'unitPrice' => '0.01']],
        ])->assertOk();

        $this->assertSame('1.5000', $response->json('data.lines.0.unitPrice'));
        $this->assertSame('3.0000', $response->json('data.lines.0.lineTotal'));
        $this->assertSame('computed', $response->json('data.priceState'));
    }

    public function test_idempotent_submit_and_conflict(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1.0000']],
        ])->json('data');

        $payload = [
            'externalId' => 'b65be7b7-fccd-44c8-90fb-f93f15338bb0',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '1.0000']],
        ];

        $first = $this->postJson('/api/v1/orders', $payload)->assertSuccessful()->json('data');
        $second = $this->postJson('/api/v1/orders', $payload)->assertSuccessful()->json('data');
        $this->assertSame($first['erpOrderId'], $second['erpOrderId']);
        $this->assertCount(1, FakeErpState::$orders);
        $this->assertSame(1, ErpOrderReceipt::query()->count());

        $payload['lines'][0]['quantity'] = '2.0000';
        $this->postJson('/api/v1/orders', $payload)
            ->assertStatus(409)
            ->assertJsonPath('code', 'IDEMPOTENCY_CONFLICT');
    }

    public function test_line_write_failure_rolls_back_receipt(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->json('data');

        FakeErpState::$failNextLineWrite = true;

        $this->postJson('/api/v1/orders', [
            'externalId' => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertStatus(503);

        $this->assertSame([], FakeErpState::$orders);
        $this->assertSame(0, ErpOrderReceipt::query()->count());
    }

    public function test_price_change_requires_reconfirm(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->json('data');

        FakeErpState::$products[0]['Fasi1'] = '9.9900';

        $this->postJson('/api/v1/orders', [
            'externalId' => 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertStatus(409)->assertJsonPath('code', 'PRICE_CHANGED');
    }

    public function test_unresolved_promotion_does_not_block_submit(): void
    {
        FakeErpState::$promotions = [[
            'IdActions' => 'G1',
            'IdActionsT' => 1,
            'ActionsT' => 'Add product',
            'Prioriteti' => 1,
            'products' => [['IdProd' => '0001']],
        ]];
        Sanctum::actingAs($this->preseller(11));

        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertOk()->json('data');

        $this->assertSame('computed', $quote['priceState']);
        $this->assertSame([], $quote['unresolvedRules']);
        $this->assertSame('1.5000', $quote['lines'][0]['unitPrice']);
        $this->assertNull($quote['lines'][0]['promoUnitPrice']);

        $this->postJson('/api/v1/orders', [
            'externalId' => 'dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertSuccessful();
    }

    public function test_prioriteti_winner_is_reported_but_not_charged_and_loser_is_hidden(): void
    {
        FakeErpState::$promotions = [
            [
                'IdActions' => 'LOW',
                'Actions' => 'Winner',
                'IdActionsT' => 2,
                'Prioriteti' => 1,
                'Data' => '2026-01-01',
                'DataEnd' => '2026-12-31',
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '1.1000']],
            ],
            [
                'IdActions' => 'HIGH',
                'Actions' => 'Loser',
                'IdActionsT' => 2,
                'Prioriteti' => 50,
                'Data' => '2026-01-01',
                'DataEnd' => '2026-12-31',
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '0.5000']],
            ],
        ];
        Sanctum::actingAs($this->preseller(11));

        $promos = $this->getJson('/api/v1/promotions?customerId=1001')->assertOk()->json('data.items');
        $this->assertCount(1, $promos);
        $this->assertSame('LOW', $promos[0]['id']);
        $this->assertSame('winner', $promos[0]['state']);

        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '2']],
        ])->assertOk()->json('data');

        $this->assertSame('computed', $quote['priceState']);
        $this->assertSame('1.5000', $quote['lines'][0]['unitPrice']);
        $this->assertSame('1.1000', $quote['lines'][0]['promoUnitPrice']);
        $this->assertSame('0.8000', $quote['lines'][0]['promoDiscount']);
        $this->assertSame('0.8000', $quote['promoDiscountTotal']);
        $this->assertSame('3.0000', $quote['total']);

        $this->postJson('/api/v1/orders', [
            'externalId' => 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '2']],
        ])->assertSuccessful();
    }

    public function test_raod1_threshold_gates_promo_price(): void
    {
        FakeErpState::$promotions = [[
            'IdActions' => 'R1',
            'IdActionsT' => 2,
            'Prioriteti' => 1,
            'ActionsRaod1' => 5,
            'ActionsRaod2' => 10,
            'products' => [['IdProd' => '0001', 'ActionsFasi' => '1.1000']],
        ]];
        Sanctum::actingAs($this->preseller(11));

        $this->getJson('/api/v1/promotions?customerId=1001')
            ->assertOk()
            ->assertJsonPath('data.items.0.minQty', 5)
            ->assertJsonPath('data.items.0.maxQty', 10);

        $below = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '4']],
        ])->assertOk()->json('data');
        $this->assertSame('1.5000', $below['lines'][0]['unitPrice']);
        $this->assertNull($below['lines'][0]['promoUnitPrice']);

        $atThreshold = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '5']],
        ])->assertOk()->json('data');
        $this->assertSame('1.5000', $atThreshold['lines'][0]['unitPrice']);
        $this->assertSame('1.1000', $atThreshold['lines'][0]['promoUnitPrice']);

        $aboveMax = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '11']],
        ])->assertOk()->json('data');
        $this->assertSame('1.5000', $aboveMax['lines'][0]['unitPrice']);
        $this->assertNull($aboveMax['lines'][0]['promoUnitPrice']);
    }

    public function test_t3_reads_raod3_and_ignores_raod1(): void
    {
        FakeErpState::$promotions = [[
            'IdActions' => 'T3',
            'IdActionsT' => 3,
            'Prioriteti' => 1,
            'ActionsRaod3' => 6,
            'ActionsRaod1' => 999,
            'ActionsRaod2' => 10,
            'FromStandardFasi' => 0,
            'ActionsPercent' => '14',
            'products' => [['IdProd' => '0001']],
        ]];
        Sanctum::actingAs($this->preseller(11));

        $this->getJson('/api/v1/promotions?customerId=1001')
            ->assertOk()
            ->assertJsonPath('data.items.0.minQty', 6)
            ->assertJsonPath('data.items.0.maxQty', null);

        $below = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '5']],
        ])->assertOk()->json('data');
        $this->assertSame('1.5000', $below['lines'][0]['unitPrice']);
        $this->assertNull($below['lines'][0]['promoUnitPrice']);

        // Raod3 qualifies at 6, and neither Raod1 nor Raod2 applies to T=3.
        $atThreshold = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '6']],
        ])->assertOk()->json('data');
        $this->assertSame('1.5000', $atThreshold['lines'][0]['unitPrice']);
        $this->assertSame('1.2900', $atThreshold['lines'][0]['promoUnitPrice']);

        $aboveRaod2 = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '50']],
        ])->assertOk()->json('data');
        $this->assertSame('1.5000', $aboveRaod2['lines'][0]['unitPrice']);
        $this->assertSame(
            $atThreshold['lines'][0]['promoUnitPrice'],
            $aboveRaod2['lines'][0]['promoUnitPrice'],
        );
    }

    public function test_qty_tier_beats_lower_prioriteti_when_bulk_does_not_apply(): void
    {
        FakeErpState::$promotions = [
            [
                'IdActions' => 'SMALL',
                'IdActionsT' => 2,
                'Prioriteti' => 50,
                'ActionsRaod1' => 5,
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '1.0000']],
            ],
            [
                'IdActions' => 'BULK',
                'IdActionsT' => 2,
                'Prioriteti' => 1,
                'ActionsRaod1' => 100,
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '0.8600']],
            ],
        ];
        Sanctum::actingAs($this->preseller(11));

        $this->getJson('/api/v1/promotions?customerId=1001')
            ->assertOk()
            ->assertJsonCount(2, 'data.items');

        $atTen = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '10']],
        ])->assertOk()->json('data');
        $this->assertSame('1.5000', $atTen['lines'][0]['unitPrice']);
        $this->assertSame('1.0000', $atTen['lines'][0]['promoUnitPrice']);

        $atHundred = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '100']],
        ])->assertOk()->json('data');
        $this->assertSame('1.5000', $atHundred['lines'][0]['unitPrice']);
        $this->assertSame('0.8600', $atHundred['lines'][0]['promoUnitPrice']);
    }

    public function test_zero_promo_price_never_becomes_free_goods(): void
    {
        FakeErpState::$promotions = [[
            'IdActions' => 'Z1',
            'IdActionsT' => 2,
            'Prioriteti' => 1,
            'products' => [['IdProd' => '0001', 'ActionsFasi' => '.0000']],
        ]];
        Sanctum::actingAs($this->preseller(11));

        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '2']],
        ])->assertOk()->json('data');

        $this->assertSame('1.5000', $quote['lines'][0]['unitPrice']);
        $this->assertNull($quote['lines'][0]['promoUnitPrice']);
        $this->assertSame('0.0000', $quote['promoDiscountTotal']);
        $this->assertSame('3.0000', $quote['total']);
        $this->assertSame('computed', $quote['priceState']);

        $this->postJson('/api/v1/orders', [
            'externalId' => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '2']],
        ])->assertSuccessful();
    }

    public function test_promo_discount_total_sums_lines_without_reducing_total(): void
    {
        FakeErpState::$promotions = [[
            'IdActions' => 'MULTI',
            'IdActionsT' => 2,
            'Prioriteti' => 1,
            'products' => [
                ['IdProd' => '0001', 'ActionsFasi' => '1.1000'],
                ['IdProd' => '0002', 'ActionsFasi' => '2.0000'],
            ],
        ]];
        Sanctum::actingAs($this->preseller(11));

        $listFirst = $this->getJson('/api/v1/items/0001?customerId=1001')->json('data.unitPrice');
        $listSecond = $this->getJson('/api/v1/items/0002?customerId=1001')->json('data.unitPrice');

        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [
                ['itemId' => '0001', 'quantity' => '2'],
                ['itemId' => '0002', 'quantity' => '3'],
            ],
        ])->assertOk()->json('data');

        $this->assertSame($listFirst, $quote['lines'][0]['unitPrice']);
        $this->assertSame($listSecond, $quote['lines'][1]['unitPrice']);

        $expectedTotal = bcadd(
            bcmul($listFirst, '2', 4),
            bcmul($listSecond, '3', 4),
            4,
        );
        $this->assertSame($expectedTotal, $quote['total']);

        $expectedDiscount = bcadd(
            $quote['lines'][0]['promoDiscount'],
            $quote['lines'][1]['promoDiscount'],
            4,
        );
        $this->assertSame($expectedDiscount, $quote['promoDiscountTotal']);
        $this->assertTrue(bccomp($quote['promoDiscountTotal'], '0.0000', 4) > 0);
    }

    public function test_sagad_exclude_drops_promotion(): void
    {
        FakeErpState::$promotions = [[
            'IdActions' => 'EX1',
            'IdActionsT' => 2,
            'Prioriteti' => 1,
            'Sagad' => [['Sagad' => '123456789', 'Exclude' => 1]],
            'products' => [['IdProd' => '0001', 'ActionsFasi' => '0.1000']],
        ]];
        Sanctum::actingAs($this->preseller(11));

        $this->getJson('/api/v1/promotions?customerId=1001')
            ->assertOk()
            ->assertJsonPath('data.items', []);
    }

    public function test_promotions_require_customer_and_authorization(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $this->getJson('/api/v1/promotions')->assertStatus(400)->assertJsonPath('code', 'CUSTOMER_REQUIRED');

        Sanctum::actingAs($this->preseller(12));
        $this->getJson('/api/v1/promotions?customerId=1001')->assertStatus(404);
    }

    public function test_promotions_empty_filter_lists_products_for_assigned_customer(): void
    {
        FakeErpState::$promotions = [
            [
                'IdActions' => 'A1',
                'Actions' => 'Fix water',
                'ActionsT' => 'ფიქსირებული ფასი',
                'IdActionsT' => 2,
                'Data' => '2026-01-01',
                'DataEnd' => '2026-12-31',
                'products' => [['IdProd' => '0001', 'ActionsFasi' => '1.2000']],
            ],
            [
                'IdActions' => 'A99',
                'Actions' => 'Other type',
                'ActionsT' => 'mismatch',
                'IdActionsT' => 2,
                'IdOrgT' => [99],
                'products' => [['IdProd' => '0002', 'ActionsFasi' => '9.0000']],
            ],
        ];
        Sanctum::actingAs($this->preseller(11));

        $payload = $this->getJson('/api/v1/promotions?customerId=1001')
            ->assertOk()
            ->json('data');

        $this->assertSame('indicative', $payload['state']);
        $this->assertCount(1, $payload['items']);
        $this->assertSame('A1', $payload['items'][0]['id']);
        $this->assertSame('Fix water', $payload['items'][0]['name']);
        $this->assertSame('winner', $payload['items'][0]['state']);
        $this->assertSame('0001', $payload['items'][0]['products'][0]['itemId']);
        $this->assertSame('1.2000', $payload['items'][0]['products'][0]['promoPrice']);
        $this->assertSame('fixed', $payload['items'][0]['products'][0]['kind']);
        $this->assertSame('Water 1.5L', $payload['items'][0]['products'][0]['name']);
    }

    public function test_mismatched_promotion_does_not_block_submit(): void
    {
        FakeErpState::$promotions = [[
            'IdActions' => 'A99',
            'IdActionsT' => 2,
            'IdOrgT' => [99],
        ]];
        Sanctum::actingAs($this->preseller(11));

        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertOk()->json('data');

        $this->assertSame('computed', $quote['priceState']);

        $this->postJson('/api/v1/orders', [
            'externalId' => 'eeeeeeee-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertSuccessful();
    }

    public function test_received_status_is_not_posted(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->json('data');

        $created = $this->postJson('/api/v1/orders', [
            'externalId' => 'eeeeeeee-bbbb-4ccc-8ddd-ffffffffffff',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->json('data');

        $this->assertSame('received', $created['status']);
        $this->getJson('/api/v1/orders/'.$created['erpOrderId'].'/status')
            ->assertOk()
            ->assertJsonPath('data.status', 'received');
    }

    public function test_davit_cannot_read_nino_receipt(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->json('data');
        $created = $this->postJson('/api/v1/orders', [
            'externalId' => 'ffffffff-bbbb-4ccc-8ddd-ffffffffffff',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->json('data');

        Sanctum::actingAs($this->preseller(12));
        $this->getJson('/api/v1/orders/'.$created['erpOrderId'].'/status')->assertStatus(404);
        $davitList = collect($this->getJson('/api/v1/orders')->json('data'))->pluck('erpOrderId')->all();
        $this->assertNotContains($created['erpOrderId'], $davitList);
    }

    public function test_sales_rep_lists_only_own_submitted_receipts(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonPath('data', []);

        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->json('data');
        $created = $this->postJson('/api/v1/orders', [
            'externalId' => 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->json('data');

        $list = $this->getJson('/api/v1/orders')->assertOk()->json('data');
        $this->assertCount(1, $list);
        $this->assertSame($created['erpOrderId'], $list[0]['erpOrderId']);
        $this->assertSame('1001', $list[0]['customerId']);
        $this->assertSame('received', $list[0]['status']);

        Sanctum::actingAs($this->preseller(12));
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonPath('data', []);
    }

    public function test_invalid_quantity_precision_rejected(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '123456789']],
        ])->assertStatus(422)->assertJsonPath('code', 'INVALID_QUANTITY');
    }

    public function test_quote_converts_packs_to_pieces_via_compraod(): void
    {
        FakeErpState::$products[0]['CompRaod'] = '24.0000';
        FakeErpState::$products[0]['CanRealHalfComp'] = true;
        Sanctum::actingAs($this->preseller(11));

        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertOk()->json('data');

        $this->assertSame('1.0000', $quote['lines'][0]['quantity']);
        $this->assertSame('1.0000', $quote['lines'][0]['packQuantity']);
        $this->assertSame('24.0000', $quote['lines'][0]['pieces']);
        $this->assertSame('24.0000', $quote['lines'][0]['compRaod']);
        $this->assertSame('36.0000', $quote['lines'][0]['lineTotal']);
        $this->assertSame('36.0000', $quote['total']);
    }

    public function test_quote_reports_customer_order_limits(): void
    {
        FakeErpState::$customers[0]['MinReal'] = 250;
        FakeErpState::$customers[0]['MaxReal'] = 1150;
        Sanctum::actingAs($this->preseller(11));

        $limited = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '2']],
        ])->assertOk()->json('data');

        $this->assertSame('250.00', $limited['orderLimits']['minTotal']);
        $this->assertSame('1150.00', $limited['orderLimits']['maxTotal']);
        $this->assertSame('3.0000', $limited['total']);

        $unlimited = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1002',
            'lines' => [['itemId' => '0001', 'quantity' => '2']],
        ])->assertOk()->json('data');

        $this->assertNull($unlimited['orderLimits']['minTotal']);
        $this->assertNull($unlimited['orderLimits']['maxTotal']);
    }

    public function test_half_pack_allowed_when_org_and_product_flags_are_on(): void
    {
        FakeErpState::$products[0]['CompRaod'] = '24.0000';
        FakeErpState::$products[0]['CanRealHalfComp'] = true;
        Sanctum::actingAs($this->preseller(11));

        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '0.5']],
        ])->assertOk()->json('data');

        $this->assertSame('0.5000', $quote['lines'][0]['packQuantity']);
        $this->assertSame('12.0000', $quote['lines'][0]['pieces']);
        $this->assertSame('18.0000', $quote['lines'][0]['lineTotal']);
    }

    public function test_half_pack_rejected_when_product_flag_is_off(): void
    {
        FakeErpState::$products[0]['CompRaod'] = '24.0000';
        FakeErpState::$products[0]['CanRealHalfComp'] = false;
        Sanctum::actingAs($this->preseller(11));

        $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '0.5']],
        ])->assertStatus(422)->assertJsonPath('code', 'HALF_PACK_NOT_ALLOWED');
    }

    public function test_half_pack_rejected_when_orgt_flag_is_off(): void
    {
        FakeErpState::$products[0]['CompRaod'] = '24.0000';
        FakeErpState::$products[0]['CanRealHalfComp'] = true;
        Sanctum::actingAs($this->preseller(11));

        $this->getJson('/api/v1/customers/1002')
            ->assertOk()
            ->assertJsonPath('data.canRealHalfComp', false);

        $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1002',
            'lines' => [['itemId' => '0001', 'quantity' => '0.5']],
        ])->assertStatus(422)->assertJsonPath('code', 'HALF_PACK_NOT_ALLOWED');
    }

    public function test_items_expose_pack_and_half_flags(): void
    {
        FakeErpState::$products[0]['CompRaod'] = '24.0000';
        FakeErpState::$products[0]['CanRealHalfComp'] = true;
        Sanctum::actingAs($this->preseller(11));

        $this->getJson('/api/v1/items/0001?customerId=1001')
            ->assertOk()
            ->assertJsonPath('data.compRaod', '24.0000')
            ->assertJsonPath('data.canRealHalfComp', true);
    }

    public function test_customer_list_totals_keep_today_within_all(): void
    {
        \Carbon\Carbon::setTestNow(\Carbon\Carbon::parse('2026-09-16 12:00:00', 'Asia/Tbilisi'));

        try {
            Sanctum::actingAs($this->preseller(11));
            $page = $this->getJson('/api/v1/customers?day=all')->assertOk()->json('data');

            $this->assertSame(3, $page['allTotal']);
            $this->assertSame(2, $page['todayTotal']);
            $this->assertLessThanOrEqual($page['allTotal'], $page['todayTotal']);
            $this->assertEqualsCanonicalizing(['1001', '1002', '3001'], collect($page['items'])->pluck('customerId')->all());

            $today = $this->getJson('/api/v1/customers?day=today')->assertOk()->json('data');
            $this->assertSame(3, $today['allTotal']);
            $this->assertSame(2, $today['todayTotal']);
            $this->assertEqualsCanonicalizing(['1001', '1002'], collect($today['items'])->pluck('customerId')->all());
        } finally {
            \Carbon\Carbon::setTestNow();
        }
    }

    public function test_today_filter_uses_tbilisi_weekday_and_skips_zero_coords(): void
    {
        \Carbon\Carbon::setTestNow(\Carbon\Carbon::parse('2026-09-16 12:00:00', 'Asia/Tbilisi'));

        try {
            Sanctum::actingAs($this->preseller(11));

            $today = collect($this->getJson('/api/v1/customers?day=today')->json('data.items'));
            $this->assertEqualsCanonicalizing(['1001', '1002'], $today->pluck('customerId')->all());

            $all = collect($this->getJson('/api/v1/customers?day=all')->json('data.items'));
            $this->assertEqualsCanonicalizing(['1001', '1002', '3001'], $all->pluck('customerId')->all());

            $zero = $all->firstWhere('customerId', '1002');
            $this->assertFalse(\App\Erp\Support\GeoPoint::isPlottable($zero['latitude'], $zero['longitude']));
            $plot = $all->firstWhere('customerId', '1001');
            $this->assertTrue(\App\Erp\Support\GeoPoint::isPlottable($plot['latitude'], $plot['longitude']));
        } finally {
            \Carbon\Carbon::setTestNow();
        }
    }

    public function test_supervisor_can_only_read_own_team_sales_user(): void
    {
        $superA = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
        $superB = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
        $nino = $this->preseller(11, ['supervisor_id' => $superA->id]);
        $davit = $this->preseller(12, ['supervisor_id' => $superB->id]);

        Sanctum::actingAs($superA);
        $this->getJson('/api/v1/customers')->assertStatus(400)->assertJsonPath('code', 'SALES_USER_REQUIRED');
        $own = collect($this->getJson('/api/v1/customers?salesUserId='.$nino->id)->json('data.items'))
            ->pluck('customerId')->all();
        $this->assertEqualsCanonicalizing(['1001', '1002', '3001'], $own);

        $this->getJson('/api/v1/customers?salesUserId='.$davit->id)
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN_PRESELLER');

        $teamIds = collect($this->getJson('/api/v1/team-reps')->json('data'))->pluck('id')->all();
        $this->assertSame([$nino->id], $teamIds);

        Sanctum::actingAs($nino);
        $spoofed = collect($this->getJson('/api/v1/customers?salesUserId='.$davit->id)->json('data.items'))
            ->pluck('customerId')->all();
        $this->assertEqualsCanonicalizing(['1001', '1002', '3001'], $spoofed);
    }

    public function test_nino_collects_cash_davit_cannot_see_or_write(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $created = $this->postJson('/api/v1/collections', [
            'customerId' => '1001',
            'amount' => '12.50',
            'method' => 'cash',
            'note' => 'visit',
        ])->assertCreated()->json('data');

        $this->assertSame('1001', $created['customerId']);
        $this->assertSame('12.50', $created['amount']);
        $this->assertSame('cash', $created['method']);
        $this->assertSame('Org A', $created['customerName']);

        $list = $this->getJson('/api/v1/collections?customerId=1001')->assertOk()->json('data');
        $this->assertCount(1, $list);
        $this->assertSame($created['id'], $list[0]['id']);

        $all = $this->getJson('/api/v1/collections')->assertOk()->json('data');
        $this->assertCount(1, $all);
        $this->assertSame('Org A', $all[0]['customerName']);

        $this->getJson('/api/v1/collections/'.$created['id'])
            ->assertOk()
            ->assertJsonPath('data.id', $created['id'])
            ->assertJsonPath('data.customerName', 'Org A');

        $updated = $this->patchJson('/api/v1/collections/'.$created['id'], [
            'amount' => '20.00',
            'note' => 'edited',
        ])->assertOk()->json('data');
        $this->assertSame('20.00', $updated['amount']);
        $this->assertSame('edited', $updated['note']);

        $this->postJson('/api/v1/collections', [
            'customerId' => '2001',
            'amount' => '1.00',
            'method' => 'cash',
        ])->assertStatus(404);

        Sanctum::actingAs($this->preseller(12));
        $this->getJson('/api/v1/collections?customerId=1001')->assertStatus(404);
        $this->getJson('/api/v1/collections/'.$created['id'])->assertStatus(404);
        $this->patchJson('/api/v1/collections/'.$created['id'], ['amount' => '1.00'])->assertStatus(404);
        $this->getJson('/api/v1/collections?customerId=2001')->assertOk()->assertJsonPath('data', []);
        $this->postJson('/api/v1/collections', [
            'customerId' => '1001',
            'amount' => '9.00',
            'method' => 'cash',
        ])->assertStatus(404);
    }

    public function test_collect_rejects_non_positive_amount(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $this->postJson('/api/v1/collections', [
            'customerId' => '1001',
            'amount' => '0',
            'method' => 'cash',
        ])->assertStatus(422)->assertJsonPath('code', 'INVALID_AMOUNT');
    }

    public function test_nino_creates_product_return_davit_cannot_see_or_write(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $created = $this->postJson('/api/v1/product-returns', [
            'customerId' => '1001',
            'note' => 'crate',
            'lines' => [
                ['itemId' => '0001', 'quantity' => '2', 'reason' => 'damaged'],
            ],
        ])->assertCreated()->json('data');

        $this->assertSame('1001', $created['customerId']);
        $this->assertSame('0001', $created['lines'][0]['itemId']);
        $this->assertSame('2.0000', $created['lines'][0]['quantity']);
        $this->assertSame('damaged', $created['lines'][0]['reason']);

        $list = $this->getJson('/api/v1/product-returns?customerId=1001')->assertOk()->json('data');
        $this->assertCount(1, $list);
        $this->assertSame($created['id'], $list[0]['id']);

        $all = $this->getJson('/api/v1/product-returns')->assertOk()->json('data');
        $this->assertCount(1, $all);
        $this->assertSame('Org A', $all[0]['customerName']);

        $this->getJson('/api/v1/product-returns/'.$created['id'])
            ->assertOk()
            ->assertJsonPath('data.id', $created['id'])
            ->assertJsonPath('data.customerName', 'Org A');

        $updated = $this->patchJson('/api/v1/product-returns/'.$created['id'], [
            'customerId' => '1001',
            'note' => 'edited crate',
            'lines' => [
                ['itemId' => '0001', 'quantity' => '3', 'reason' => 'expired'],
            ],
        ])->assertOk()->json('data');
        $this->assertSame('3.0000', $updated['lines'][0]['quantity']);
        $this->assertSame('expired', $updated['lines'][0]['reason']);
        $this->assertSame('edited crate', $updated['note']);

        $this->postJson('/api/v1/product-returns', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0004', 'quantity' => '1', 'reason' => 'damaged']],
        ])->assertStatus(404);

        Sanctum::actingAs($this->preseller(12));
        $this->getJson('/api/v1/product-returns?customerId=1001')->assertStatus(404);
        $this->getJson('/api/v1/product-returns/'.$created['id'])->assertStatus(404);
        $this->patchJson('/api/v1/product-returns/'.$created['id'], [
            'lines' => [['itemId' => '0001', 'quantity' => '1', 'reason' => 'expired']],
        ])->assertStatus(404);
        $this->postJson('/api/v1/product-returns', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1', 'reason' => 'expired']],
        ])->assertStatus(404);
    }

    public function test_nino_saves_order_locally_davit_cannot_see(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $created = $this->postJson('/api/v1/saved-orders', [
            'customerId' => '1001',
            'note' => 'visit',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertCreated()->json('data');

        $this->assertSame('1001', $created['customerId']);
        $this->assertSame('Org A', $created['customerName']);
        $this->assertSame('0001', $created['lines'][0]['itemId']);
        $this->assertSame('1.50', $created['total']);

        $list = $this->getJson('/api/v1/saved-orders')->assertOk()->json('data');
        $this->assertCount(1, $list);
        $this->assertSame($created['id'], $list[0]['id']);

        $this->getJson('/api/v1/saved-orders/'.$created['id'])
            ->assertOk()
            ->assertJsonPath('data.total', '1.50');

        $updated = $this->patchJson('/api/v1/saved-orders/'.$created['id'], [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '2']],
        ])->assertOk()->json('data');
        $this->assertSame('3.00', $updated['total']);

        $this->postJson('/api/v1/saved-orders', [
            'customerId' => '2001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertStatus(404);

        Sanctum::actingAs($this->preseller(12));
        $this->getJson('/api/v1/saved-orders')->assertOk()->assertJsonPath('data', []);
        $this->getJson('/api/v1/saved-orders/'.$created['id'])->assertStatus(404);
        $this->patchJson('/api/v1/saved-orders/'.$created['id'], [
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertStatus(404);
        $this->postJson('/api/v1/saved-orders', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertStatus(404);
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function preseller(int $idGvari, array $extra = []): User
    {
        return User::factory()->create(array_merge([
            'role' => UserRole::SalesRep,
            'id_gvari' => $idGvari,
        ], $extra));
    }
}
