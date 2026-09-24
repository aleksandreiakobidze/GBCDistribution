<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpPlanogramLine extends Model
{
    protected $fillable = [
        'customer_id',
        'org_category_id',
        'shelf_no',
        'position',
        'item_id',
        'item_name',
        'facings',
        'target_price',
        'created_by',
    ];

    protected $casts = [
        'org_category_id' => 'integer',
        'shelf_no' => 'integer',
        'position' => 'integer',
        'facings' => 'integer',
        'target_price' => 'float',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'customerId' => $this->customer_id === null ? null : (string) $this->customer_id,
            'orgCategoryId' => $this->org_category_id === null ? null : (int) $this->org_category_id,
            'shelfNo' => (int) $this->shelf_no,
            'position' => (int) $this->position,
            'itemId' => (string) $this->item_id,
            'itemName' => $this->item_name,
            'facings' => (int) $this->facings,
            'targetPrice' => $this->target_price === null ? null : (float) $this->target_price,
        ];
    }
}
