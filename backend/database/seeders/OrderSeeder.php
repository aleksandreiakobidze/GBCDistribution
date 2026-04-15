<?php

namespace Database\Seeders;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ReturnCondition;
use App\Enums\ReturnStatus;
use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\CustomerVisit;
use App\Models\Delivery;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReturnItem;
use App\Models\ReturnOrder;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class OrderSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $this->seedOrders();
            $this->seedStockMovements();
            $this->seedCustomerVisits();
        });
    }

    private function seedOrders(): void
    {
        $nino = User::where('email', 'nino@bsc.ge')->first();
        $davit = User::where('email', 'davit@bsc.ge')->first();
        $tornike = User::where('email', 'tornike@bsc.ge')->first();
        $admin = User::where('email', 'admin@bsc.ge')->first();
        $mainWarehouse = Warehouse::where('is_default', true)->first();
        $products = Product::all();

        $ninoCustomers = Customer::where('assigned_sales_rep_id', $nino->id)->get();
        $davitCustomers = Customer::where('assigned_sales_rep_id', $davit->id)->get();

        $statusDistribution = array_merge(
            array_fill(0, 10, OrderStatus::Pending),
            array_fill(0, 5, OrderStatus::Confirmed),
            array_fill(0, 3, OrderStatus::Picking),
            array_fill(0, 3, OrderStatus::Packed),
            array_fill(0, 5, OrderStatus::Dispatched),
            array_fill(0, 20, OrderStatus::Delivered),
            array_fill(0, 4, OrderStatus::Cancelled),
        );
        shuffle($statusDistribution);

        $deliveredCount = 0;
        $invoiceSeq = 1;

        foreach ($statusDistribution as $i => $status) {
            $isNino = $i % 2 === 0;
            $salesRep = $isNino ? $nino : $davit;
            $customerPool = $isNino ? $ninoCustomers : $davitCustomers;
            $customer = $customerPool->random();

            $orderedAt = Carbon::now()->subDays(rand(1, 90))->subHours(rand(0, 23))->subMinutes(rand(0, 59));

            $order = Order::create([
                'order_number' => sprintf('BSC-2026-%05d', $i + 1),
                'customer_id'  => $customer->id,
                'sales_rep_id' => $salesRep->id,
                'warehouse_id' => $mainWarehouse->id,
                'status'       => $status,
                'subtotal'     => 0,
                'discount_amount' => 0,
                'tax_amount'   => 0,
                'total'        => 0,
                'notes'        => $this->getRandomNote(),
                'ordered_at'   => $orderedAt,
            ]);

            $itemCount = rand(2, 6);
            $selectedProducts = $products->random($itemCount);
            $subtotal = 0;

            foreach ($selectedProducts as $product) {
                $qty = rand(1, 20);
                $discountPercent = fake()->randomElement([0, 0, 0, 0, 5, 10]);
                $unitPrice = (float) $product->price;
                $lineTotal = round($qty * $unitPrice * (1 - $discountPercent / 100), 2);
                $subtotal += $lineTotal;

                OrderItem::create([
                    'order_id'         => $order->id,
                    'product_id'       => $product->id,
                    'quantity'         => $qty,
                    'unit_price'       => $unitPrice,
                    'discount_percent' => $discountPercent,
                    'line_total'       => $lineTotal,
                ]);
            }

            $order->update([
                'subtotal' => $subtotal,
                'total'    => $subtotal,
            ]);

            if (in_array($status, [OrderStatus::Dispatched, OrderStatus::Delivered])) {
                $deliveryStatus = $status === OrderStatus::Delivered
                    ? DeliveryStatus::Delivered
                    : DeliveryStatus::InTransit;

                $scheduledDate = $orderedAt->copy()->addDays(rand(1, 3));
                $deliveredAt = $status === OrderStatus::Delivered
                    ? $scheduledDate->copy()->addHours(rand(2, 8))
                    : null;

                Delivery::create([
                    'order_id'       => $order->id,
                    'driver_id'      => $tornike->id,
                    'status'         => $deliveryStatus,
                    'scheduled_date' => $scheduledDate->toDateString(),
                    'delivered_at'   => $deliveredAt,
                    'notes'          => null,
                    'latitude'       => $customer->latitude,
                    'longitude'      => $customer->longitude,
                ]);

                $invoiceNumber = sprintf('INV-2026-%05d', $invoiceSeq++);
                $dueDate = $orderedAt->copy()->addDays(30);

                $paidAmount = 0;
                $invoiceStatus = PaymentStatus::Sent;

                if ($status === OrderStatus::Delivered) {
                    $deliveredCount++;
                    $shouldPay = $deliveredCount % 5 !== 0; // ~80% get payments

                    if ($shouldPay) {
                        $isFullPayment = rand(1, 100) <= 70;
                        $paidAmount = $isFullPayment ? $subtotal : round($subtotal * rand(40, 80) / 100, 2);
                        $invoiceStatus = $paidAmount >= $subtotal ? PaymentStatus::Paid : PaymentStatus::Partial;
                    }
                }

                $invoice = Invoice::create([
                    'invoice_number' => $invoiceNumber,
                    'order_id'       => $order->id,
                    'customer_id'    => $customer->id,
                    'amount'         => $subtotal,
                    'paid_amount'    => $paidAmount,
                    'due_date'       => $dueDate->toDateString(),
                    'status'         => $invoiceStatus,
                ]);

                if ($paidAmount > 0) {
                    Payment::create([
                        'invoice_id'  => $invoice->id,
                        'amount'      => $paidAmount,
                        'method'      => fake()->randomElement(PaymentMethod::cases()),
                        'paid_at'     => $deliveredAt ?? $scheduledDate->copy()->addDays(rand(1, 5)),
                        'reference'   => 'PAY-' . strtoupper(fake()->bothify('??###')),
                        'received_by' => fake()->randomElement([$nino->id, $davit->id, $admin->id]),
                    ]);
                }
            }
        }

        $this->seedReturns($tornike);
    }

    private function seedReturns(User $driver): void
    {
        $deliveredOrders = Order::where('status', OrderStatus::Delivered)
            ->inRandomOrder()
            ->limit(3)
            ->get();

        $reasons = [
            'Product damaged during delivery',
            'Customer received wrong items',
            'Items expired upon arrival',
        ];

        foreach ($deliveredOrders as $idx => $order) {
            $returnOrder = ReturnOrder::create([
                'return_number' => sprintf('RET-2026-%05d', $idx + 1),
                'order_id'      => $order->id,
                'customer_id'   => $order->customer_id,
                'reason'        => $reasons[$idx],
                'status'        => fake()->randomElement([ReturnStatus::Pending, ReturnStatus::Approved, ReturnStatus::Processed]),
                'total'         => 0,
            ]);

            $orderItems = $order->items()->inRandomOrder()->limit(rand(1, 2))->get();
            $returnTotal = 0;

            foreach ($orderItems as $orderItem) {
                $returnQty = rand(1, max(1, intval($orderItem->quantity / 2)));
                $lineAmount = round($returnQty * (float) $orderItem->unit_price, 2);
                $returnTotal += $lineAmount;

                ReturnItem::create([
                    'return_id'  => $returnOrder->id,
                    'product_id' => $orderItem->product_id,
                    'quantity'   => $returnQty,
                    'unit_price' => $orderItem->unit_price,
                    'condition'  => fake()->randomElement(ReturnCondition::cases()),
                ]);
            }

            $returnOrder->update(['total' => $returnTotal]);
        }
    }

    private function seedStockMovements(): void
    {
        $admin = User::where('email', 'admin@bsc.ge')->first();
        $levan = User::where('email', 'levan@bsc.ge')->first();
        $mainWarehouse = Warehouse::where('is_default', true)->first();
        $products = Product::all();

        $movements = [];
        $now = Carbon::now();

        foreach ($products as $product) {
            $movements[] = [
                'warehouse_id'   => $mainWarehouse->id,
                'product_id'     => $product->id,
                'type'           => StockMovementType::In->value,
                'quantity'       => rand(100, 500),
                'reference_type' => null,
                'reference_id'   => null,
                'user_id'        => $levan->id,
                'notes'          => 'Initial stock receipt',
                'created_at'     => $now->copy()->subDays(rand(85, 95)),
                'updated_at'     => $now->copy()->subDays(rand(85, 95)),
            ];
        }

        $deliveredOrders = Order::where('status', OrderStatus::Delivered)->with('items')->get();
        foreach ($deliveredOrders as $order) {
            foreach ($order->items as $item) {
                $movements[] = [
                    'warehouse_id'   => $mainWarehouse->id,
                    'product_id'     => $item->product_id,
                    'type'           => StockMovementType::Out->value,
                    'quantity'       => $item->quantity,
                    'reference_type' => Order::class,
                    'reference_id'   => $order->id,
                    'user_id'        => $levan->id,
                    'notes'          => "Order {$order->order_number} dispatch",
                    'created_at'     => $order->ordered_at->copy()->addDay(),
                    'updated_at'     => $order->ordered_at->copy()->addDay(),
                ];
            }
        }

        $adjustmentProducts = $products->random(min(15, $products->count()));
        foreach ($adjustmentProducts as $product) {
            $movements[] = [
                'warehouse_id'   => $mainWarehouse->id,
                'product_id'     => $product->id,
                'type'           => StockMovementType::Adjustment->value,
                'quantity'       => rand(-5, 5),
                'reference_type' => null,
                'reference_id'   => null,
                'user_id'        => $admin->id,
                'notes'          => fake()->randomElement([
                    'Stock count adjustment',
                    'Damaged goods write-off',
                    'Inventory audit correction',
                ]),
                'created_at'     => $now->copy()->subDays(rand(1, 30)),
                'updated_at'     => $now->copy()->subDays(rand(1, 30)),
            ];
        }

        $chunkedMovements = array_chunk($movements, 50);
        foreach ($chunkedMovements as $chunk) {
            DB::table('stock_movements')->insert($chunk);
        }
    }

    private function seedCustomerVisits(): void
    {
        $nino = User::where('email', 'nino@bsc.ge')->first();
        $davit = User::where('email', 'davit@bsc.ge')->first();
        $now = Carbon::now();

        $ninoCustomers = Customer::where('assigned_sales_rep_id', $nino->id)->get();
        $davitCustomers = Customer::where('assigned_sales_rep_id', $davit->id)->get();

        $visitNotes = [
            'Regular check-in, shelves well stocked.',
            'Discussed new product promotions.',
            'Customer requested larger order next week.',
            'Resolved complaint about last delivery.',
            'Introduced new snack products.',
            'Customer interested in credit limit increase.',
            'Checked competitor product placement.',
            'Collected payment for outstanding invoices.',
            'Customer was closed, will revisit.',
            'Placed emergency restock order.',
        ];

        $visits = [];
        $ordersWithVisits = Order::inRandomOrder()->limit(10)->get();
        $orderVisitMap = [];
        foreach ($ordersWithVisits as $order) {
            $orderVisitMap[$order->id] = $order;
        }

        for ($i = 0; $i < 40; $i++) {
            $isNino = $i % 2 === 0;
            $salesRep = $isNino ? $nino : $davit;
            $pool = $isNino ? $ninoCustomers : $davitCustomers;
            $customer = $pool->random();

            $visitedAt = $now->copy()->subDays(rand(1, 60))->setHour(rand(9, 17))->setMinute(rand(0, 59));

            $orderId = null;
            $hasOrder = false;
            if (!empty($orderVisitMap)) {
                $key = array_key_first($orderVisitMap);
                $matchedOrder = $orderVisitMap[$key];
                unset($orderVisitMap[$key]);
                $orderId = $matchedOrder->id;
                $hasOrder = true;
                $customer = Customer::find($matchedOrder->customer_id);
                $visitedAt = $matchedOrder->ordered_at;
            }

            $visits[] = [
                'customer_id' => $customer->id,
                'user_id'     => $salesRep->id,
                'visited_at'  => $visitedAt,
                'latitude'    => $customer->latitude,
                'longitude'   => $customer->longitude,
                'notes'       => $visitNotes[array_rand($visitNotes)],
                'order_id'    => $orderId,
                'has_order'   => $hasOrder,
                'created_at'  => $visitedAt,
                'updated_at'  => $visitedAt,
            ];
        }

        $chunked = array_chunk($visits, 50);
        foreach ($chunked as $chunk) {
            DB::table('customer_visits')->insert($chunk);
        }
    }

    private function getRandomNote(): ?string
    {
        $notes = [
            null,
            null,
            null,
            'Urgent delivery requested.',
            'Customer prefers morning delivery.',
            'Leave at back entrance.',
            'Call before delivery.',
            'Fragile items - handle with care.',
            'Repeat order from last month.',
            'New customer - first order.',
        ];

        return $notes[array_rand($notes)];
    }
}
