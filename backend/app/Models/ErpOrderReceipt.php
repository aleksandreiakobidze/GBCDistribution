<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpOrderReceipt extends Model
{
    protected $fillable = [
        'provider',
        'company',
        'user_id',
        'external_id',
        'payload_hash',
        'customer_id',
        'id_gvari',
        'quote_id',
        'erp_order_id',
        'status',
        'result_json',
    ];

    protected function casts(): array
    {
        return [
            'result_json' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
