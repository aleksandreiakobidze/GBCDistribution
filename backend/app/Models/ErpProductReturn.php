<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErpProductReturn extends Model
{
    protected $fillable = [
        'user_id',
        'id_gvari',
        'customer_id',
        'customer_name',
        'warehouse_id',
        'warehouse_name',
        'note',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ErpProductReturnLine::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'customerId' => (string) $this->customer_id,
            'customerName' => $this->customer_name,
            'warehouseId' => $this->warehouse_id !== null && $this->warehouse_id !== ''
                ? (string) $this->warehouse_id
                : null,
            'warehouseName' => $this->warehouse_name,
            'note' => $this->note,
            'createdAt' => $this->created_at?->toIso8601String(),
            'lines' => $this->lines->map(fn (ErpProductReturnLine $line) => [
                'itemId' => $line->item_id,
                'name' => $line->item_name,
                'quantity' => number_format((float) $line->quantity, 4, '.', ''),
                'reason' => $line->reason,
            ])->values()->all(),
        ];
    }
}
