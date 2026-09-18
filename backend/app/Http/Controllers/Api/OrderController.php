<?php

namespace App\Http\Controllers\Api;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\UserRole;
use App\Http\Requests\StoreOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Delivery;
use App\Models\Invoice;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['customer', 'salesRep']);

        $user = $request->user();

        if ($user->role === UserRole::SalesRep) {
            $query->where('sales_rep_id', $user->id);
        } elseif ($user->role === UserRole::Warehouse) {
            $query->whereNotIn('status', [OrderStatus::Pending]);
        } elseif ($user->role === UserRole::Driver) {
            $query->whereRaw('1 = 0');
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $orders = $query->latest()->paginate(20);

        return $this->sendResponse(
            OrderResource::collection($orders)->response()->getData(true),
            'Orders retrieved successfully.'
        );
    }

    public function show(int $id, Request $request): JsonResponse
    {
        $order = Order::with([
            'customer',
            'salesRep',
            'items.product',
            'delivery.driver',
            'invoice',
        ])->findOrFail($id);

        $user = $request->user();
        if ($user->role === UserRole::SalesRep && $order->sales_rep_id !== $user->id) {
            return $this->sendError('Unauthorized.', 403);
        }
        if ($user->role === UserRole::Driver) {
            $hasDelivery = $order->delivery && $order->delivery->driver_id === $user->id;
            if (!$hasDelivery) {
                return $this->sendError('Unauthorized.', 403);
            }
        }

        return $this->sendResponse(
            new OrderResource($order),
            'Order retrieved successfully.'
        );
    }

    public function store(StoreOrderRequest $request): JsonResponse
    {
        $order = DB::transaction(function () use ($request) {
            $subtotal = 0;
            $discountAmount = 0;
            $itemsData = [];

            foreach ($request->items as $item) {
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
                'customer_id' => $request->customer_id,
                'sales_rep_id' => $request->user()->id,
                'warehouse_id' => $request->warehouse_id,
                'status' => OrderStatus::Pending,
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'tax_amount' => 0,
                'total' => $total,
                'notes' => $request->notes,
                'offline_id' => $request->offline_id,
                'ordered_at' => now(),
            ]);

            $order->items()->createMany($itemsData);

            return $order;
        });

        $order->load(['customer', 'salesRep', 'items.product']);

        return $this->sendResponse(
            new OrderResource($order),
            'Order created successfully.',
            201
        );
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $order = Order::with(['items'])->findOrFail($id);
        $user = $request->user();

        if ($user->role === UserRole::SalesRep && $order->sales_rep_id !== $user->id) {
            return $this->sendError('Unauthorized.', 403);
        }

        if ($order->status !== OrderStatus::Pending) {
            return $this->sendError('Only pending orders can be edited.', 422);
        }

        $data = $request->validate([
            'notes' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        DB::transaction(function () use ($order, $data) {
            $payload = [];
            if (array_key_exists('notes', $data)) {
                $payload['notes'] = $data['notes'];
            }

            if (isset($data['items'])) {
                $subtotal = 0;
                $discountAmount = 0;
                $itemsData = [];

                foreach ($data['items'] as $item) {
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

                $payload['subtotal'] = $subtotal;
                $payload['discount_amount'] = $discountAmount;
                $payload['total'] = $subtotal - $discountAmount;

                $order->items()->delete();
                $order->items()->createMany($itemsData);
            }

            if ($payload !== []) {
                $order->update($payload);
            }
        });

        return $this->sendResponse(
            new OrderResource($order->fresh(['customer', 'salesRep', 'items.product', 'delivery.driver', 'invoice'])),
            'Order updated successfully.'
        );
    }

    public function updateStatus(int $id, Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string'],
        ]);

        $order = Order::findOrFail($id);
        $newStatus = OrderStatus::from($request->status);

        $allowedTransitions = [
            OrderStatus::Pending->value => [OrderStatus::Confirmed, OrderStatus::Cancelled],
            OrderStatus::Confirmed->value => [OrderStatus::Picking, OrderStatus::Cancelled],
            OrderStatus::Picking->value => [OrderStatus::Packed],
            OrderStatus::Packed->value => [OrderStatus::Dispatched],
            OrderStatus::Dispatched->value => [OrderStatus::Delivered],
        ];

        $allowed = $allowedTransitions[$order->status->value] ?? [];

        if (!in_array($newStatus, $allowed)) {
            return $this->sendError(
                "Cannot transition from {$order->status->value} to {$newStatus->value}.",
                422
            );
        }

        DB::transaction(function () use ($order, $newStatus) {
            $order->update(['status' => $newStatus]);

            if ($newStatus === OrderStatus::Confirmed) {
                if (!$order->delivery) {
                    Delivery::create([
                        'order_id' => $order->id,
                        'status' => DeliveryStatus::Pending,
                        'scheduled_date' => now()->addDay(),
                    ]);
                }

                if (!$order->invoice) {
                    Invoice::create([
                        'order_id' => $order->id,
                        'customer_id' => $order->customer_id,
                        'amount' => $order->total,
                        'paid_amount' => 0,
                        'due_date' => now()->addDays(30),
                        'status' => PaymentStatus::Draft,
                    ]);
                }
            }
        });

        return $this->sendResponse(
            new OrderResource($order->fresh(['customer', 'salesRep', 'delivery', 'invoice'])),
            'Order status updated successfully.'
        );
    }
}
