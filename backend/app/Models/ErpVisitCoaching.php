<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpVisitCoaching extends Model
{
    protected $table = 'erp_visit_coaching';

    protected $fillable = ['visit_id', 'user_id', 'supervisor_id', 'rating', 'note'];

    public function sales(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(ErpVisit::class, 'visit_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'visitId' => (int) $this->visit_id,
            'customerId' => $this->visit?->customer_id,
            'customerName' => $this->visit?->customer_name,
            'salesUserId' => (int) $this->user_id,
            'salesName' => $this->sales?->name,
            'supervisorName' => $this->supervisor?->name,
            'rating' => (int) $this->rating,
            'note' => $this->note,
        ];
    }
}
