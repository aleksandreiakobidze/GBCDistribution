<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErpSavedOrder extends Model
{
    protected $fillable = [
        'user_id',
        'id_gvari',
        'customer_id',
        'customer_name',
        'total',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ErpSavedOrderLine::class);
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
            'total' => number_format((float) $this->total, 2, '.', ''),
            'note' => $this->note,
            'createdAt' => $this->created_at?->toIso8601String(),
            'lines' => $this->lines->map(fn (ErpSavedOrderLine $line) => [
                'itemId' => $line->item_id,
                'name' => $line->item_name,
                'packQuantity' => number_format((float) $line->pack_quantity, 4, '.', ''),
                'pieces' => number_format((float) $line->pieces, 4, '.', ''),
                'unitPrice' => number_format((float) $line->unit_price, 4, '.', ''),
                'lineTotal' => number_format((float) $line->line_total, 2, '.', ''),
            ])->values()->all(),
        ];
    }
}
