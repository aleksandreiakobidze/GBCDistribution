<?php

namespace App\Models;

use App\Erp\Support\TbilisiClock;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErpShelfAudit extends Model
{
    protected $fillable = [
        'user_id', 'id_gvari', 'customer_id', 'customer_name', 'visit_id', 'photo_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ErpShelfAuditLine::class, 'audit_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'salesUserId' => (int) $this->user_id,
            'salesName' => $this->user?->name,
            'customerId' => (string) $this->customer_id,
            'customerName' => $this->customer_name,
            'visitId' => $this->visit_id === null ? null : (int) $this->visit_id,
            'photoId' => $this->photo_id === null ? null : (int) $this->photo_id,
            'createdAt' => TbilisiClock::iso($this->created_at),
            'lines' => $this->lines->map(fn (ErpShelfAuditLine $line) => [
                'itemId' => $line->item_id,
                'itemName' => $line->item_name,
                'status' => $line->status,
            ])->values()->all(),
        ];
    }
}
