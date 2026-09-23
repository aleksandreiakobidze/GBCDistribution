<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpVisitSurvey extends Model
{
    protected $fillable = [
        'visit_id', 'user_id', 'id_gvari', 'customer_id', 'customer_name',
        'shelf_stocked', 'price_visible', 'promo_present', 'competitor_seen',
    ];

    protected function casts(): array
    {
        return [
            'shelf_stocked' => 'boolean',
            'price_visible' => 'boolean',
            'promo_present' => 'boolean',
            'competitor_seen' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'visitId' => (int) $this->visit_id,
            'salesUserId' => (int) $this->user_id,
            'salesName' => $this->user?->name,
            'customerId' => (string) $this->customer_id,
            'customerName' => $this->customer_name,
            'shelfStocked' => (bool) $this->shelf_stocked,
            'priceVisible' => (bool) $this->price_visible,
            'promoPresent' => (bool) $this->promo_present,
            'competitorSeen' => (bool) $this->competitor_seen,
        ];
    }
}
