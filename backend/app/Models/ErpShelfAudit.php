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
            'lines' => $this->lines->map(function (ErpShelfAuditLine $line) {
                $box = null;
                if ($line->box_x !== null && $line->box_y !== null && $line->box_w !== null && $line->box_h !== null) {
                    $box = [
                        'x' => (float) $line->box_x,
                        'y' => (float) $line->box_y,
                        'w' => (float) $line->box_w,
                        'h' => (float) $line->box_h,
                    ];
                }

                return [
                    'itemId' => $line->item_id,
                    'itemName' => $line->item_name,
                    'status' => $line->status,
                    'shelfNo' => $line->shelf_no === null ? null : (int) $line->shelf_no,
                    'facings' => (int) ($line->facings ?? 1),
                    'readPrice' => $line->read_price === null ? null : (float) $line->read_price,
                    'competitor' => (bool) $line->competitor,
                    'box' => $box,
                ];
            })->values()->all(),
        ];
    }
}
