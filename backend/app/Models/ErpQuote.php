<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpQuote extends Model
{
    protected $fillable = [
        'quote_id',
        'user_id',
        'customer_id',
        'payload_hash',
        'quote_json',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'quote_json' => 'array',
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
