<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpCollection extends Model
{
    protected $fillable = [
        'user_id',
        'id_gvari',
        'customer_id',
        'customer_name',
        'amount',
        'method',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array{id: int, customerId: string, customerName: string|null, amount: string, method: string, note: string|null, createdAt: string|null}
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'customerId' => (string) $this->customer_id,
            'customerName' => $this->customer_name,
            'amount' => number_format((float) $this->amount, 2, '.', ''),
            'method' => (string) $this->method,
            'note' => $this->note,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
