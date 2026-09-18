<?php

namespace App\Http\Controllers\Api;

use App\Enums\StockMovementType;
use App\Http\Requests\InventoryAdjustRequest;
use App\Http\Resources\InventoryItemResource;
use App\Http\Resources\StockMovementResource;
use App\Models\InventoryItem;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = InventoryItem::with('product');

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->boolean('low_stock')) {
            $query->whereColumn('quantity', '<=', 'min_stock_level');
        }

        $items = $query->paginate(20);

        return $this->sendResponse(
            InventoryItemResource::collection($items)->response()->getData(true),
            'Inventory items retrieved successfully.'
        );
    }

    public function adjust(InventoryAdjustRequest $request): JsonResponse
    {
        $result = DB::transaction(function () use ($request) {
            $type = $request->quantity > 0
                ? StockMovementType::In
                : StockMovementType::Out;

            $movement = StockMovement::create([
                'warehouse_id' => $request->warehouse_id,
                'product_id' => $request->product_id,
                'type' => StockMovementType::Adjustment,
                'quantity' => $request->quantity,
                'user_id' => $request->user()->id,
                'notes' => $request->notes,
            ]);

            $inventoryItem = InventoryItem::firstOrCreate(
                [
                    'warehouse_id' => $request->warehouse_id,
                    'product_id' => $request->product_id,
                ],
                [
                    'quantity' => 0,
                    'reserved_quantity' => 0,
                    'min_stock_level' => 0,
                ]
            );

            $inventoryItem->increment('quantity', $request->quantity);

            return $inventoryItem;
        });

        return $this->sendResponse(
            new InventoryItemResource($result->fresh('product')),
            'Inventory adjusted successfully.'
        );
    }

    public function movements(Request $request): JsonResponse
    {
        $query = StockMovement::with(['product', 'user']);

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        $movements = $query->latest()->paginate(20);

        return $this->sendResponse(
            StockMovementResource::collection($movements)->response()->getData(true),
            'Stock movements retrieved successfully.'
        );
    }
}
