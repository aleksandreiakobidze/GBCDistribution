<?php

namespace App\Http\Controllers\Api;

use App\Enums\ReturnStatus;
use App\Enums\StockMovementType;
use App\Http\Requests\StoreReturnRequest;
use App\Http\Resources\ReturnResource;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\ReturnOrder;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReturnController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $returns = ReturnOrder::with(['customer', 'order'])
            ->latest()
            ->paginate(20);

        return $this->sendResponse(
            ReturnResource::collection($returns)->response()->getData(true),
            'Returns retrieved successfully.'
        );
    }

    public function store(StoreReturnRequest $request): JsonResponse
    {
        $returnOrder = DB::transaction(function () use ($request) {
            $order = Order::findOrFail($request->order_id);

            $total = 0;
            $itemsData = [];

            foreach ($request->items as $item) {
                $lineTotal = $item['quantity'] * $item['unit_price'];
                $total += $lineTotal;

                $itemsData[] = [
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'condition' => $item['condition'],
                ];
            }

            $returnOrder = ReturnOrder::create([
                'order_id' => $order->id,
                'customer_id' => $order->customer_id,
                'reason' => $request->reason,
                'status' => ReturnStatus::Pending,
                'total' => $total,
            ]);

            $returnOrder->items()->createMany($itemsData);

            return $returnOrder;
        });

        $returnOrder->load(['customer', 'order', 'items.product']);

        return $this->sendResponse(
            new ReturnResource($returnOrder),
            'Return created successfully.',
            201
        );
    }

    public function updateStatus(int $id, Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string'],
        ]);

        $returnOrder = ReturnOrder::with('items')->findOrFail($id);
        $newStatus = ReturnStatus::from($request->status);

        DB::transaction(function () use ($returnOrder, $newStatus, $request) {
            $returnOrder->update(['status' => $newStatus]);

            if ($newStatus === ReturnStatus::Processed) {
                $order = $returnOrder->order;

                foreach ($returnOrder->items as $item) {
                    StockMovement::create([
                        'warehouse_id' => $order->warehouse_id,
                        'product_id' => $item->product_id,
                        'type' => StockMovementType::Return,
                        'quantity' => $item->quantity,
                        'reference_type' => ReturnOrder::class,
                        'reference_id' => $returnOrder->id,
                        'user_id' => $request->user()->id,
                        'notes' => "Return #{$returnOrder->return_number}",
                    ]);

                    $inventoryItem = InventoryItem::firstOrCreate(
                        [
                            'warehouse_id' => $order->warehouse_id,
                            'product_id' => $item->product_id,
                        ],
                        [
                            'quantity' => 0,
                            'reserved_quantity' => 0,
                            'min_stock_level' => 0,
                        ]
                    );

                    $inventoryItem->increment('quantity', $item->quantity);
                }
            }
        });

        return $this->sendResponse(
            new ReturnResource($returnOrder->fresh(['customer', 'order', 'items.product'])),
            'Return status updated successfully.'
        );
    }
}
