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
        $this->getJson('/api/v1/customers/2001')->assertStatus(404);
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

    public function test_unresolved_promotion_blocks_submit_not_quote(): void
    {
        FakeErpState::$promotions = [['IdActions' => 1, 'ActionsT' => 'Sale']];
        Sanctum::actingAs($this->preseller(11));

        $quote = $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertOk()->json('data');

        $this->assertSame('indicative', $quote['priceState']);

        $this->postJson('/api/v1/orders', [
            'externalId' => 'dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            'customerId' => '1001',
            'quoteId' => $quote['quoteId'],
            'lines' => [['itemId' => '0001', 'quantity' => '1']],
        ])->assertStatus(422)->assertJsonPath('code', 'PRICING_RULE_UNRESOLVED');
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
    }

    public function test_invalid_quantity_precision_rejected(): void
    {
        Sanctum::actingAs($this->preseller(11));
        $this->postJson('/api/v1/orders/quote', [
            'customerId' => '1001',
            'lines' => [['itemId' => '0001', 'quantity' => '123456789']],
        ])->assertStatus(422)->assertJsonPath('code', 'INVALID_QUANTITY');
    }

    private function preseller(int $idGvari): User
    {
        return User::factory()->create([
            'role' => UserRole::SalesRep,
            'id_gvari' => $idGvari,
        ]);
    }
}
