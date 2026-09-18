<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeliveryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'order' => new OrderResource($this->whenLoaded('order')),
            'driver' => new UserResource($this->whenLoaded('driver')),
            'status' => $this->status,
            'scheduled_date' => $this->scheduled_date?->toDateString(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'signature_image' => $this->signature_image,
            'delivery_photo' => $this->delivery_photo,
            'notes' => $this->notes,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
        ];
    }
}
