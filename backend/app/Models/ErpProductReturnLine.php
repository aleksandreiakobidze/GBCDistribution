<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpProductReturnLine extends Model
{
    protected $fillable = [
        'erp_product_return_id',
        'item_id',
        'item_name',
        'quantity',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
        ];
    }

    public function productReturn(): BelongsTo
    {
        return $this->belongsTo(ErpProductReturn::class, 'erp_product_return_id');
    }
}
