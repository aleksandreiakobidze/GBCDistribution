<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpSavedOrderLine extends Model
{
    protected $fillable = [
        'erp_saved_order_id',
        'item_id',
        'item_name',
        'pack_quantity',
        'pieces',
        'unit_price',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'pack_quantity' => 'decimal:4',
            'pieces' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'line_total' => 'decimal:2',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(ErpSavedOrder::class, 'erp_saved_order_id');
    }
}
