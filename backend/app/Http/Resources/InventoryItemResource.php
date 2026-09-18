<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'warehouse_id' => $this->warehouse_id,
            'product' => new ProductResource($this->whenLoaded('product')),
            'quantity' => $this->quantity,
            'reserved_quantity' => $this->reserved_quantity,
            'min_stock_level' => $this->min_stock_level,
            'available' => $this->quantity - $this->reserved_quantity,
        ];
    }
}
