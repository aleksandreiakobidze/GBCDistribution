<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'name_ka' => $this->name_ka,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'unit' => $this->unit,
            'price' => $this->price,
            'cost_price' => $this->cost_price,
            'image' => $this->image,
            'is_active' => $this->is_active,
            'category' => new CategoryResource($this->whenLoaded('category')),
        ];
    }
}
