<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Http\Requests\SyncOrdersRequest;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\ProductResource;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SyncController extends BaseController
{
    public function pushOrders(SyncOrdersRequest $request): JsonResponse
    {
        $createdIds = [];

        DB::transaction(function () use ($request, &$createdIds) {
            foreach ($request->orders as $orderData) {
                if (!empty($orderData['offline_id'])) {
                    $existing = Order::where('offline_id', $orderData['offline_id'])->first();
                    if ($existing) {
                        $createdIds[] = ['offline_id' => $orderData['offline_id'], 'id' => $existing->id, 'skipped' => true];
                        continue;
                    }
                }

                $subtotal = 0;
                $discountAmount = 0;
                $itemsData = [];

                foreach ($orderData['items'] as $item) {
                    $discountPercent = $item['discount_percent'] ?? 0;
                    $lineTotal = $item['quantity'] * $item['unit_price'] * (1 - $discountPercent / 100);
                    $lineDiscount = $item['quantity'] * $item['unit_price'] * ($discountPercent / 100);

                    $subtotal += $item['quantity'] * $item['unit_price'];
                    $discountAmount += $lineDiscount;

                    $itemsData[] = [
                        'product_id' => $item['product_id'],
                        'quantity' => $item['quantity'],
                        'unit_price' => $item['unit_price'],
                        'discount_percent' => $discountPercent,
                        'line_total' => $lineTotal,
                    ];
                }

                $total = $subtotal - $discountAmount;

                $order = Order::create([
                    'customer_id' => $orderData['customer_id'],
                    'sales_rep_id' => $request->user()->id,
                    'warehouse_id' => $orderData['warehouse_id'],
                    'status' => OrderStatus::Pending,
                    'subtotal' => $subtotal,
                    'discount_amount' => $discountAmount,
                    'tax_amount' => 0,
                    'total' => $total,
                    'notes' => $orderData['notes'] ?? null,
                    'offline_id' => $orderData['offline_id'] ?? null,
                    'ordered_at' => now(),
                ]);

                $order->items()->createMany($itemsData);

                $createdIds[] = [
                    'offline_id' => $orderData['offline_id'] ?? null,
                    'id' => $order->id,
                    'skipped' => false,
                ];
            }
        });

        return $this->sendResponse(
            ['orders' => $createdIds],
            'Orders synced successfully.'
        );
    }

    public function pull(Request $request): JsonResponse
    {
        $user = $request->user();

        $products = Product::with('category')->where('is_active', true)->get();
        $categories = Category::orderBy('sort_order')->get();

        $customersQuery = Customer::where('is_active', true);
        if ($user->role === UserRole::SalesRep) {
            $customersQuery->where('assigned_sales_rep_id', $user->id);
        }
        $customers = $customersQuery->get();

        return $this->sendResponse([
            'products' => ProductResource::collection($products),
            'categories' => CategoryResource::collection($categories),
            'customers' => CustomerResource::collection($customers),
        ], 'Data pulled successfully.');
    }
}
