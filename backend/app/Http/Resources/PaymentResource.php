<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_id' => $this->invoice_id,
            'amount' => $this->amount,
            'method' => $this->method,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'reference' => $this->reference,
            'received_by' => new UserResource($this->whenLoaded('receivedBy')),
        ];
    }
}
