<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Erp\Fake\FakeErpState;
use App\Erp\Support\GeoPoint;
use App\Models\ErpOrderReceipt;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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
        Carbon::setTestNow(Carbon::parse('2026-09-16 12:00:00', 'Asia/Tbilisi'));

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
            Carbon::setTestNow();
        }
    }

    public function test_today_filter_uses_tbilisi_weekday_and_skips_zero_coords(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-16 12:00:00', 'Asia/Tbilisi'));

        try {
            Sanctum::actingAs($this->preseller(11));

            $today = collect($this->getJson('/api/v1/customers?day=today')->json('data.items'));
            $this->assertEqualsCanonicalizing(['1001', '1002'], $today->pluck('customerId')->all());

            $all = collect($this->getJson('/api/v1/customers?day=all')->json('data.items'));
            $this->assertEqualsCanonicalizing(['1001', '1002', '3001'], $all->pluck('customerId')->all());

            $zero = $all->firstWhere('customerId', '1002');
            $this->assertFalse(GeoPoint::isPlottable($zero['latitude'], $zero['longitude']));
            $plot = $all->firstWhere('customerId', '1001');
            $this->assertTrue(GeoPoint::isPlottable($plot['latitude'], $plot['longitude']));
        } finally {
            Carbon::setTestNow();
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

    public function test_field_visit_stays_with_the_sales_rep_and_their_supervisor(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-22 14:05:00', 'Asia/Tbilisi'));

        try {
            $superA = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
            $superB = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
            $nino = $this->preseller(11, ['supervisor_id' => $superA->id]);
            $davit = $this->preseller(12, ['supervisor_id' => $superB->id]);

            Sanctum::actingAs($nino);
            $started = $this->postJson('/api/v1/visits', [
                'customerId' => '1001',
                'latitude' => '41.9150000',
                'longitude' => '45.4730000',
            ])->assertCreated()->json('data');

            $this->assertSame('1001', $started['customerId']);
            $this->assertSame('Org A', $started['customerName']);
            $this->assertSame('open', $started['status']);
            $this->assertSame('41.9150000', $started['latitude']);
            $this->assertNull($started['endedAt']);

            $this->postJson('/api/v1/visits', ['customerId' => '1002'])
                ->assertStatus(409)
                ->assertJsonPath('code', 'VISIT_ALREADY_OPEN');

            $finished = $this->patchJson('/api/v1/visits/'.$started['id'], [
                'outcome' => 'arrived',
            ])->assertOk()->json('data');
            $this->assertSame('arrived', $finished['status']);
            $this->assertNotNull($finished['endedAt']);

            $today = $this->getJson('/api/v1/visits?day=today')->assertOk()->json('data');
            $this->assertCount(1, $today);
            $this->assertSame($started['id'], $today[0]['id']);

            Sanctum::actingAs($davit);
            $this->assertSame([], $this->getJson('/api/v1/visits?day=today')->json('data'));
            $this->patchJson('/api/v1/visits/'.$started['id'], ['outcome' => 'missed'])
                ->assertStatus(404)
                ->assertJsonPath('code', 'VISIT_NOT_FOUND');

            Sanctum::actingAs($superA);
            $seen = $this->getJson('/api/v1/visits?day=today&salesUserId='.$nino->id)->assertOk()->json('data');
            $this->assertSame([$started['id']], collect($seen)->pluck('id')->all());
            $this->postJson('/api/v1/visits?salesUserId='.$nino->id, ['customerId' => '1001'])
                ->assertStatus(403)
                ->assertJsonPath('code', 'VISIT_READ_ONLY');

            Sanctum::actingAs($superB);
            $this->getJson('/api/v1/visits?day=today&salesUserId='.$nino->id)
                ->assertStatus(403)
                ->assertJsonPath('code', 'FORBIDDEN_PRESELLER');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_visit_photo_stays_with_the_sales_rep_and_their_supervisor(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-09-22 14:05:00', 'Asia/Tbilisi'));

        try {
            $superA = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
            $superB = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
            $nino = $this->preseller(11, ['supervisor_id' => $superA->id]);
            $davit = $this->preseller(12, ['supervisor_id' => $superB->id]);

            Sanctum::actingAs($nino);
            $created = $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'before',
                'comment' => 'თარო',
                'tags' => '#თარო #ფასი',
                'latitude' => '41.9150000',
                'longitude' => '45.4730000',
                'photo' => UploadedFile::fake()->image('shelf.jpg', 20, 20),
            ])->assertCreated()->json('data');

            $this->assertSame('before', $created['phase']);
            $this->assertSame('Org A', $created['customerName']);
            $this->assertSame(['თარო', 'ფასი'], $created['tags']);
            $this->assertSame('თარო', $created['comment']);
            $this->assertNull($created['visitId']);
            $this->assertSame('41.9150000', $created['latitude']);

            $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'end',
                'photo' => UploadedFile::fake()->image('end.jpg', 20, 20),
            ])->assertStatus(422)->assertJsonPath('code', 'VISIT_REQUIRED');

            $this->postJson('/api/v1/visits', ['customerId' => '1001'])->assertCreated();
            $ended = $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'end',
                'photo' => UploadedFile::fake()->image('end.jpg', 20, 20),
            ])->assertCreated()->json('data');
            $this->assertSame('end', $ended['phase']);
            $this->assertNotNull($ended['visitId']);

            $list = $this->getJson('/api/v1/visit-photos?customerId=1001')->assertOk()->json('data');
            $this->assertCount(2, $list);
            $this->get('/api/v1/visit-photos/'.$created['id'].'/file')->assertOk();

            Sanctum::actingAs($davit);
            $this->assertSame([], $this->getJson('/api/v1/visit-photos?customerId=1001')->json('data'));
            $this->get('/api/v1/visit-photos/'.$created['id'].'/file')
                ->assertStatus(404)
                ->assertJsonPath('code', 'PHOTO_NOT_FOUND');

            Sanctum::actingAs($superA);
            $seen = $this->getJson('/api/v1/visit-photos?customerId=1001&salesUserId='.$nino->id)
                ->assertOk()
                ->json('data');
            $this->assertCount(2, $seen);
            $this->get('/api/v1/visit-photos/'.$created['id'].'/file?salesUserId='.$nino->id)->assertOk();
            $this->post('/api/v1/visit-photos?salesUserId='.$nino->id, [
                'customerId' => '1001',
                'phase' => 'before',
                'photo' => UploadedFile::fake()->image('nope.jpg', 20, 20),
            ])->assertStatus(403)->assertJsonPath('code', 'PHOTO_READ_ONLY');

            Sanctum::actingAs($superB);
            $this->getJson('/api/v1/visit-photos?customerId=1001&salesUserId='.$nino->id)
                ->assertStatus(403)
                ->assertJsonPath('code', 'FORBIDDEN_PRESELLER');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_gallery_photo_stays_with_the_owning_supervisor(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-09-22 14:05:00', 'Asia/Tbilisi'));

        try {
            $superA = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null, 'name' => 'Sofo A']);
            $superB = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
            $nino = $this->preseller(11, ['supervisor_id' => $superA->id]);
            $davit = $this->preseller(12, ['supervisor_id' => $superB->id]);

            Sanctum::actingAs($nino);
            $created = $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'before',
                'comment' => 'თარო',
                'tags' => '#თარო',
                'photo' => UploadedFile::fake()->image('shelf.jpg', 20, 20),
            ])->assertCreated()->json('data');
            $second = $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'before',
                'photo' => UploadedFile::fake()->image('shelf-2.jpg', 20, 20),
            ])->assertCreated()->json('data');

            Sanctum::actingAs($superA);
            $list = $this->getJson('/api/v1/gallery/photos')->assertOk()->json('data');
            $this->assertEqualsCanonicalizing([$created['id'], $second['id']], collect($list)->pluck('id')->all());
            $this->assertSame('Org A', $list[0]['signature']);
            $this->assertSame('თარო', collect($list)->firstWhere('id', $created['id'])['comment']);

            $bySignature = $this->getJson('/api/v1/gallery/photos?q=Org')->assertOk()->json('data');
            $this->assertCount(2, $bySignature);
            $byTag = $this->getJson('/api/v1/gallery/photos?tag=თარო')->assertOk()->json('data');
            $this->assertSame([$created['id']], collect($byTag)->pluck('id')->all());
            $this->assertCount(2, $this->getJson('/api/v1/gallery/photos?day=2026-09-22')->json('data'));
            $this->assertSame([], $this->getJson('/api/v1/gallery/photos?day=2026-09-21')->json('data'));

            $reviewed = $this->patchJson('/api/v1/gallery/photos/'.$created['id'], [
                'signature' => 'თარო A',
                'reviewComment' => 'კარგია',
                'rating' => 4,
                'rotation' => 90,
                'reviewed' => true,
            ])->assertOk()->json('data');
            $this->assertSame('თარო A', $reviewed['signature']);
            $this->assertSame('კარგია', $reviewed['reviewComment']);
            $this->assertSame('თარო', $reviewed['comment']);
            $this->assertSame(4, $reviewed['rating']);
            $this->assertSame(90, $reviewed['rotation']);
            $this->assertSame('Sofo A', $reviewed['reviewedByName']);
            $this->assertNotNull($reviewed['reviewedAt']);

            $this->get('/api/v1/gallery/photos/'.$created['id'].'/file')->assertOk();
            $this->postJson('/api/v1/gallery/photos/download', ['ids' => [$created['id']]])
                ->assertOk()
                ->assertHeader('content-type', 'image/jpeg');
            $zip = $this->postJson('/api/v1/gallery/photos/download', ['ids' => [$created['id'], $second['id']]]);
            $zip->assertOk();
            $this->assertStringContainsString('zip', (string) $zip->headers->get('content-type'));

            Sanctum::actingAs($nino);
            $own = $this->getJson('/api/v1/gallery/photos')->assertOk()->json('data');
            $this->assertEqualsCanonicalizing([$created['id'], $second['id']], collect($own)->pluck('id')->all());
            $this->get('/api/v1/gallery/photos/'.$created['id'].'/file')->assertOk();
            $this->patchJson('/api/v1/gallery/photos/'.$created['id'], [
                'rotation' => 0,
                'reviewed' => false,
            ])->assertStatus(403)->assertJsonPath('code', 'GALLERY_FORBIDDEN');
            $this->postJson('/api/v1/gallery/photos/download', ['ids' => [$created['id']]])
                ->assertStatus(403)
                ->assertJsonPath('code', 'GALLERY_FORBIDDEN');

            Sanctum::actingAs($davit);
            $this->assertSame([], $this->getJson('/api/v1/gallery/photos')->assertOk()->json('data'));
            $this->get('/api/v1/gallery/photos/'.$created['id'].'/file')
                ->assertStatus(404)
                ->assertJsonPath('code', 'PHOTO_NOT_FOUND');
            $this->patchJson('/api/v1/gallery/photos/'.$created['id'], [
                'rotation' => 0,
                'reviewed' => false,
            ])->assertStatus(403)->assertJsonPath('code', 'GALLERY_FORBIDDEN');
            $this->postJson('/api/v1/gallery/photos/download', ['ids' => [$created['id']]])
                ->assertStatus(403)
                ->assertJsonPath('code', 'GALLERY_FORBIDDEN');

            Sanctum::actingAs($superB);
            $this->assertSame([], $this->getJson('/api/v1/gallery/photos')->json('data'));
            $this->get('/api/v1/gallery/photos/'.$created['id'].'/file')
                ->assertStatus(404)
                ->assertJsonPath('code', 'PHOTO_NOT_FOUND');
            $this->patchJson('/api/v1/gallery/photos/'.$created['id'], [
                'rotation' => 0,
                'reviewed' => false,
            ])->assertStatus(404)->assertJsonPath('code', 'PHOTO_NOT_FOUND');
            $this->postJson('/api/v1/gallery/photos/download', ['ids' => [$created['id']]])
                ->assertStatus(404)
                ->assertJsonPath('code', 'PHOTO_NOT_FOUND');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_field_work_stays_with_the_owning_supervisor(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-09-22 14:05:00', 'Asia/Tbilisi'));

        try {
            $superA = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null, 'name' => 'Sofo A']);
            $superB = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
            $nino = $this->preseller(11, ['supervisor_id' => $superA->id]);
            $davit = $this->preseller(12, ['supervisor_id' => $superB->id]);

            Sanctum::actingAs($nino);
            $visit = $this->postJson('/api/v1/visits', ['customerId' => '1001'])->assertCreated()->json('data');
            $photo = $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'shelf',
                'photo' => UploadedFile::fake()->image('shelf.jpg', 20, 20),
            ])->assertCreated()->json('data');
            $this->assertSame('shelf', $photo['phase']);
            $this->assertSame($visit['id'], $photo['visitId']);

            Sanctum::actingAs($superA);
            $task = $this->postJson('/api/v1/tasks', [
                'salesUserId' => $nino->id,
                'customerId' => '1001',
                'photoId' => $photo['id'],
                'title' => 'თარო შეავსე',
                'dueOn' => '2026-09-22',
            ])->assertCreated()->json('data');
            $this->assertSame('open', $task['status']);
            $this->assertSame($photo['id'], $task['photoId']);

            Sanctum::actingAs($davit);
            $this->assertSame([], $this->getJson('/api/v1/tasks')->json('data'));
            $this->patchJson('/api/v1/tasks/'.$task['id'], ['action' => 'complete'])
                ->assertStatus(404)
                ->assertJsonPath('code', 'TASK_NOT_FOUND');
            $this->postJson('/api/v1/tasks', [
                'salesUserId' => $nino->id,
                'title' => 'არა',
            ])->assertStatus(403);

            Sanctum::actingAs($superB);
            $this->assertSame([], $this->getJson('/api/v1/tasks')->json('data'));
            $this->patchJson('/api/v1/tasks/'.$task['id'], ['action' => 'check'])->assertStatus(404);

            Sanctum::actingAs($nino);
            $done = $this->patchJson('/api/v1/tasks/'.$task['id'], ['action' => 'complete'])->assertOk()->json('data');
            $this->assertSame('done', $done['status']);
            $this->assertNotNull($done['completedAt']);

            Sanctum::actingAs($superA);
            $checked = $this->patchJson('/api/v1/tasks/'.$task['id'], ['action' => 'check'])->assertOk()->json('data');
            $this->assertSame('Sofo A', $checked['checkedByName']);
            $this->assertNotNull($checked['checkedAt']);

            Sanctum::actingAs($nino);
            $survey = $this->postJson('/api/v1/visit-surveys', [
                'visitId' => $visit['id'],
                'shelfStocked' => true,
                'priceVisible' => true,
                'promoPresent' => false,
                'competitorSeen' => false,
            ])->assertCreated()->json('data');
            $this->assertTrue($survey['shelfStocked']);
            $this->assertFalse($survey['promoPresent']);

            Sanctum::actingAs($superA);
            $this->assertCount(1, $this->getJson('/api/v1/visit-surveys?customerId=1001')->json('data'));
            $coaching = $this->postJson('/api/v1/visit-coaching', [
                'visitId' => $visit['id'],
                'rating' => 4,
                'note' => 'კარგი ვიზიტი',
            ])->assertCreated()->json('data');
            $this->assertSame(4, $coaching['rating']);

            Sanctum::actingAs($nino);
            $seenCoaching = $this->getJson('/api/v1/visit-coaching?customerId=1001')->assertOk()->json('data');
            $this->assertSame('კარგი ვიზიტი', $seenCoaching[0]['note']);

            Sanctum::actingAs($davit);
            $this->assertSame([], $this->getJson('/api/v1/visit-surveys')->json('data'));
            $this->assertSame([], $this->getJson('/api/v1/visit-coaching')->json('data'));
            $this->postJson('/api/v1/visit-coaching', [
                'visitId' => $visit['id'],
                'rating' => 1,
            ])->assertStatus(403);

            Sanctum::actingAs($nino);
            $audit = $this->postJson('/api/v1/shelf-audits', [
                'customerId' => '1001',
                'photoId' => $photo['id'],
                'lines' => [['itemId' => '0001', 'status' => 'present']],
            ])->assertCreated()->json('data');
            $this->assertSame('present', $audit['lines'][0]['status']);
            $this->assertSame($photo['id'], $audit['photoId']);
            $this->assertSame(1, $audit['lines'][0]['facings']);
            $this->assertNull($audit['lines'][0]['shelfNo']);
            $this->assertNull($audit['lines'][0]['readPrice']);
            $this->assertFalse($audit['lines'][0]['competitor']);
            $this->assertNull($audit['lines'][0]['box']);

            $this->postJson('/api/v1/planograms', [
                'customerId' => '1001',
                'shelfNo' => 1,
                'position' => 1,
                'itemId' => '0001',
                'itemName' => 'წყალი',
                'facings' => 2,
            ])->assertStatus(403);

            Sanctum::actingAs($superA);
            $plan = $this->postJson('/api/v1/planograms', [
                'customerId' => '1001',
                'shelfNo' => 1,
                'position' => 1,
                'itemId' => '0001',
                'itemName' => 'წყალი',
                'facings' => 2,
                'targetPrice' => 1.5,
            ])->assertCreated()->json('data');
            $this->assertSame(2, $plan['facings']);
            $this->assertSame('1001', $plan['customerId']);

            Sanctum::actingAs($nino);
            $seenPlan = $this->getJson('/api/v1/planograms?customerId=1001')->assertOk()->json('data');
            $this->assertSame('0001', $seenPlan[0]['itemId']);
            $this->assertSame(1, $seenPlan[0]['shelfNo']);

            Sanctum::actingAs($davit);
            $this->getJson('/api/v1/planograms?customerId=1001')->assertStatus(404);

            Sanctum::actingAs($superB);
            $this->assertSame([], $this->getJson('/api/v1/shelf-audits')->json('data'));

            Sanctum::actingAs($superA);
            $this->assertCount(1, $this->getJson('/api/v1/shelf-audits?customerId=1001')->json('data'));
            $promo = $this->postJson('/api/v1/promo-plans', [
                'salesUserId' => $nino->id,
                'customerId' => '1001',
                'title' => 'თაროს აქცია',
                'startsOn' => '2026-09-22',
                'endsOn' => '2026-09-28',
            ])->assertCreated()->json('data');
            $copy = $this->postJson('/api/v1/promo-plans/'.$promo['id'].'/copy')->assertCreated()->json('data');
            $this->assertSame('planned', $copy['status']);
            $this->assertNull($copy['photoId']);
            $finishedPromo = $this->patchJson('/api/v1/promo-plans/'.$promo['id'], [
                'status' => 'done',
                'photoId' => $photo['id'],
            ])->assertOk()->json('data');
            $this->assertSame('done', $finishedPromo['status']);
            $this->assertSame($photo['id'], $finishedPromo['photoId']);

            Sanctum::actingAs($davit);
            $this->assertSame([], $this->getJson('/api/v1/promo-plans')->json('data'));
            $this->patchJson('/api/v1/promo-plans/'.$promo['id'], ['title' => 'არა'])->assertStatus(403);

            Sanctum::actingAs($superB);
            $this->assertSame([], $this->getJson('/api/v1/promo-plans')->json('data'));

            Sanctum::actingAs($nino);
            $this->patchJson('/api/v1/visits/'.$visit['id'], ['outcome' => 'arrived'])->assertOk();
            $day = $this->getJson('/api/v1/day')->assertOk()->json('data');
            $this->assertSame(1, $day['coverageVisited']);
            $this->assertSame(1, $day['tasksDone']);
            $this->assertSame(1, $day['tasksTotal']);
            $this->assertNotNull($day['firstVisitAt']);
            $this->assertSame($visit['id'], $day['visits'][0]['id']);

            Sanctum::actingAs($superB);
            $hidden = $this->getJson('/api/v1/day')->assertOk()->json('data');
            $this->assertSame(0, $hidden['coverageVisited']);
            $this->assertSame([], $hidden['visits']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_dashboard_reports_only_the_own_team(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-09-16 14:05:00', 'Asia/Tbilisi'));

        try {
            $superA = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null, 'name' => 'Sofo A']);
            $superB = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
            $nino = $this->preseller(11, ['supervisor_id' => $superA->id, 'name' => 'Nino']);
            $davit = $this->preseller(12, ['supervisor_id' => $superB->id]);

            Sanctum::actingAs($nino);
            $visit = $this->postJson('/api/v1/visits', ['customerId' => '1001'])->assertCreated()->json('data');
            $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'before',
                'photo' => UploadedFile::fake()->image('shelf.jpg', 20, 20),
            ])->assertCreated();
            $this->patchJson('/api/v1/visits/'.$visit['id'], ['outcome' => 'arrived'])->assertOk();
            $this->postJson('/api/v1/visit-surveys', [
                'visitId' => $visit['id'],
                'shelfStocked' => true,
                'priceVisible' => true,
                'promoPresent' => false,
                'competitorSeen' => false,
            ])->assertCreated();

            Sanctum::actingAs($superA);
            $this->postJson('/api/v1/tasks', [
                'salesUserId' => $nino->id,
                'customerId' => '1001',
                'title' => 'ვადაგასული დავალება',
                'dueOn' => '2026-09-14',
            ])->assertCreated();
            $this->postJson('/api/v1/visit-coaching', [
                'visitId' => $visit['id'],
                'rating' => 5,
                'note' => 'სუფთა თარო',
            ])->assertCreated();

            $mine = $this->getJson('/api/v1/dashboard')->assertOk()->json('data');
            $this->assertSame('supervisor', $mine['role']);
            $this->assertSame('2026-09-16', $mine['date']);
            $this->assertSame([$nino->id], collect($mine['team'])->pluck('salesUserId')->all());
            $this->assertSame('Nino', $mine['team'][0]['salesName']);
            $this->assertSame(2, $mine['team'][0]['planned']);
            $this->assertSame(1, $mine['team'][0]['visited']);
            $this->assertSame(50, $mine['team'][0]['coverage']);
            $this->assertSame(1, $mine['team'][0]['unreviewedPhotos']);
            $this->assertSame(1, $mine['totals']['reps']);
            $this->assertSame(1, $mine['totals']['visited']);
            $this->assertSame(1, $mine['totals']['openTasks']);
            $this->assertSame(1, $mine['totals']['overdueTasks']);
            $this->assertSame(1, $mine['totals']['surveyCount']);
            $this->assertSame(1, $mine['totals']['shelfStocked']);
            $this->assertCount(7, $mine['trend']);
            $this->assertSame('2026-09-16', $mine['trend'][6]['date']);
            $this->assertSame(1, $mine['trend'][6]['visits']);
            $this->assertNull($mine['me']);

            Sanctum::actingAs($superB);
            $other = $this->getJson('/api/v1/dashboard')->assertOk()->json('data');
            $this->assertSame([$davit->id], collect($other['team'])->pluck('salesUserId')->all());
            $this->assertSame(0, $other['totals']['visited']);
            $this->assertSame(0, $other['totals']['openTasks']);
            $this->assertSame(0, $other['totals']['unreviewedPhotos']);

            Sanctum::actingAs($nino);
            $own = $this->getJson('/api/v1/dashboard')->assertOk()->json('data');
            $this->assertSame('sales_rep', $own['role']);
            $this->assertSame([$nino->id], collect($own['team'])->pluck('salesUserId')->all());
            $this->assertSame(2, $own['me']['planned']);
            $this->assertSame(1, $own['me']['visited']);
            $this->assertSame(1, $own['me']['openTaskCount']);
            $this->assertSame(1, count($own['me']['photosToday']));
            $this->assertSame(5, $own['me']['coaching']['rating']);
            $this->assertSame('Sofo A', $own['me']['coaching']['supervisorName']);
            $this->assertSame('1002', $own['me']['nextStop']['customerId']);
            $this->assertNull($own['me']['openVisit']);

            Sanctum::actingAs($davit);
            $hidden = $this->getJson('/api/v1/dashboard')->assertOk()->json('data');
            $this->assertSame(0, $hidden['me']['visited']);
            $this->assertNull($hidden['me']['coaching']);
            $this->assertSame([], $hidden['me']['photosToday']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_multi_value_filters_narrow_tasks_promos_day_and_gallery(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-09-16 14:05:00', 'Asia/Tbilisi'));

        try {
            $supervisor = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null]);
            $nino = $this->preseller(11, ['supervisor_id' => $supervisor->id]);
            $davit = $this->preseller(12, ['supervisor_id' => $supervisor->id]);

            Sanctum::actingAs($nino);
            $visit = $this->postJson('/api/v1/visits', ['customerId' => '1001'])->assertCreated()->json('data');
            $tagged = $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'shelf',
                'tags' => '#თარო',
                'photo' => UploadedFile::fake()->image('shelf.jpg', 20, 20),
            ])->assertCreated()->json('data');
            $plain = $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'before',
                'photo' => UploadedFile::fake()->image('front.jpg', 20, 20),
            ])->assertCreated()->json('data');
            $this->patchJson('/api/v1/visits/'.$visit['id'], ['outcome' => 'arrived'])->assertOk();

            Sanctum::actingAs($davit);
            $davitVisit = $this->postJson('/api/v1/visits', ['customerId' => '2001'])->assertCreated()->json('data');
            $this->patchJson('/api/v1/visits/'.$davitVisit['id'], ['outcome' => 'arrived'])->assertOk();

            Sanctum::actingAs($supervisor);
            $open = $this->postJson('/api/v1/tasks', [
                'salesUserId' => $nino->id,
                'title' => 'ღია დავალება',
            ])->assertCreated()->json('data');
            $toClose = $this->postJson('/api/v1/tasks', [
                'salesUserId' => $davit->id,
                'title' => 'დახურული დავალება',
            ])->assertCreated()->json('data');

            Sanctum::actingAs($davit);
            $this->patchJson('/api/v1/tasks/'.$toClose['id'], ['action' => 'complete'])->assertOk();

            Sanctum::actingAs($supervisor);
            $this->postJson('/api/v1/promo-plans', [
                'salesUserId' => $nino->id,
                'title' => 'ნინოს აქცია',
                'startsOn' => '2026-09-14',
                'endsOn' => '2026-09-20',
            ])->assertCreated();
            $this->postJson('/api/v1/promo-plans', [
                'salesUserId' => $davit->id,
                'title' => 'დავითის აქცია',
                'startsOn' => '2026-09-14',
                'endsOn' => '2026-09-20',
            ])->assertCreated();

            $both = $this->getJson('/api/v1/tasks?status[]=open&status[]=done')->assertOk()->json('data');
            $this->assertEqualsCanonicalizing([$open['id'], $toClose['id']], collect($both)->pluck('id')->all());

            $onlyOpen = $this->getJson('/api/v1/tasks?status[]=open')->assertOk()->json('data');
            $this->assertSame([$open['id']], collect($onlyOpen)->pluck('id')->all());

            $oneRep = $this->getJson('/api/v1/tasks?salesUserId[]='.$davit->id)->assertOk()->json('data');
            $this->assertSame([$toClose['id']], collect($oneRep)->pluck('id')->all());

            $this->getJson('/api/v1/tasks?salesUserId[]=999999')
                ->assertStatus(403)
                ->assertJsonPath('code', 'FORBIDDEN_PRESELLER');

            $promos = $this->getJson('/api/v1/promo-plans?salesUserId[]='.$nino->id)->assertOk()->json('data');
            $this->assertSame(['ნინოს აქცია'], collect($promos)->pluck('title')->all());
            $this->assertCount(2, $this->getJson('/api/v1/promo-plans')->json('data'));

            $ninoDay = $this->getJson('/api/v1/day?salesUserId[]='.$nino->id)->assertOk()->json('data');
            $this->assertSame([$visit['id']], collect($ninoDay['visits'])->pluck('id')->all());

            $teamDay = $this->getJson('/api/v1/day')->assertOk()->json('data');
            $this->assertEqualsCanonicalizing(
                [$visit['id'], $davitVisit['id']],
                collect($teamDay['visits'])->pluck('id')->all(),
            );

            $byPhase = $this->getJson('/api/v1/gallery/photos?phase[]=shelf')->assertOk()->json('data');
            $this->assertSame([$tagged['id']], collect($byPhase)->pluck('id')->all());

            $byPhases = $this->getJson('/api/v1/gallery/photos?phase[]=shelf&phase[]=before')->assertOk()->json('data');
            $this->assertEqualsCanonicalizing([$tagged['id'], $plain['id']], collect($byPhases)->pluck('id')->all());

            $byTag = $this->getJson('/api/v1/gallery/photos?tag[]=თარო')->assertOk()->json('data');
            $this->assertSame([$tagged['id']], collect($byTag)->pluck('id')->all());

            $bySales = $this->getJson('/api/v1/gallery/photos?salesUserId[]='.$davit->id)->assertOk()->json('data');
            $this->assertSame([], $bySales);

            $this->patchJson('/api/v1/gallery/photos/'.$tagged['id'], [
                'rating' => 4,
                'rotation' => 0,
                'reviewed' => true,
            ])->assertOk();
            $byRating = $this->getJson('/api/v1/gallery/photos?rating[]=4&rating[]=5')->assertOk()->json('data');
            $this->assertSame([$tagged['id']], collect($byRating)->pluck('id')->all());
        } finally {
            Carbon::setTestNow();
        }
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    public function test_my_reports_counts_only_the_signed_in_sales_rep(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-09-16 14:05:00', 'Asia/Tbilisi'));

        try {
            $superA = User::factory()->create(['role' => UserRole::Supervisor, 'id_gvari' => null, 'name' => 'Sofo A']);
            $nino = $this->preseller(11, ['supervisor_id' => $superA->id, 'name' => 'Nino']);
            $davit = $this->preseller(12);

            Sanctum::actingAs($nino);
            $visit = $this->postJson('/api/v1/visits', ['customerId' => '1001'])->assertCreated()->json('data');
            $this->post('/api/v1/visit-photos', [
                'customerId' => '1001',
                'phase' => 'before',
                'photo' => UploadedFile::fake()->image('shelf.jpg', 20, 20),
            ])->assertCreated();
            $this->patchJson('/api/v1/visits/'.$visit['id'], ['outcome' => 'arrived'])->assertOk();
            $this->postJson('/api/v1/visit-surveys', [
                'visitId' => $visit['id'],
                'shelfStocked' => true,
                'priceVisible' => false,
                'promoPresent' => false,
                'competitorSeen' => true,
            ])->assertCreated();
            $this->postJson('/api/v1/collections', [
                'customerId' => '1001',
                'amount' => '12.50',
                'method' => 'cash',
            ])->assertCreated();

            Sanctum::actingAs($superA);
            $this->postJson('/api/v1/tasks', [
                'salesUserId' => $nino->id,
                'customerId' => '1001',
                'title' => 'ვადაგასული',
                'dueOn' => '2026-09-14',
            ])->assertCreated();
            $this->postJson('/api/v1/visit-coaching', [
                'visitId' => $visit['id'],
                'rating' => 5,
                'note' => 'სუფთა თარო',
            ])->assertCreated();
            $this->getJson('/api/v1/my-reports')->assertForbidden();

            Sanctum::actingAs($davit);
            $this->postJson('/api/v1/collections', [
                'customerId' => '2001',
                'amount' => '99.00',
                'method' => 'cash',
            ])->assertCreated();
            $other = $this->getJson('/api/v1/my-reports?days=7')->assertOk()->json('data');
            $this->assertSame(0, $other['visits']['finished']);
            $this->assertEquals(99, $other['money']['collected']);
            $this->assertSame([], $other['customers']);

            Sanctum::actingAs($nino);
            $mine = $this->getJson('/api/v1/my-reports?days=30')->assertOk()->json('data');
            $this->assertSame(30, $mine['days']);
            $this->assertSame(1, $mine['visits']['finished']);
            $this->assertCount(30, $mine['visits']['byDay']);
            $this->assertSame(1, $mine['survey']['count']);
            $this->assertSame(1, $mine['survey']['shelfStocked']);
            $this->assertSame(1, $mine['survey']['competitorSeen']);
            $this->assertSame(1, $mine['photos']['before']);
            $this->assertSame(1, $mine['tasks']['open']);
            $this->assertSame(1, $mine['tasks']['overdue']);
            $this->assertEquals(12.5, $mine['money']['collected']);
            $this->assertSame('1001', $mine['customers'][0]['customerId']);
            $this->assertSame(1, $mine['customers'][0]['visits']);
            $this->assertEquals(5, $mine['coaching']['averageRating']);
            $this->assertSame('სუფთა თარო', $mine['coaching']['note']);
            $this->assertSame('Sofo A', $mine['coaching']['supervisorName']);

            $todayReport = $this->getJson('/api/v1/my-reports?days=1')->assertOk()->json('data');
            $this->assertSame(1, $todayReport['days']);
            $this->assertCount(1, $todayReport['visits']['byDay']);
            $this->assertSame(1, $todayReport['visits']['finished']);
        } finally {
            Carbon::setTestNow();
        }
    }

    private function preseller(int $idGvari, array $extra = []): User
    {
        return User::factory()->create(array_merge([
            'role' => UserRole::SalesRep,
            'id_gvari' => $idGvari,
        ], $extra));
    }
}
