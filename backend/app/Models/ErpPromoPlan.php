<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpPromoPlan extends Model
{
    public const PLANNED = 'planned';

    public const ACTIVE = 'active';

    public const DONE = 'done';

    protected $fillable = [
        'created_by', 'user_id', 'id_gvari', 'customer_id', 'customer_name',
        'title', 'starts_on', 'ends_on', 'status', 'photo_id', 'note',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'salesUserId' => (int) $this->user_id,
            'salesName' => $this->assignee?->name,
            'customerId' => $this->customer_id,
            'customerName' => $this->customer_name,
            'title' => $this->title,
            'startsOn' => $this->starts_on?->toDateString(),
            'endsOn' => $this->ends_on?->toDateString(),
            'status' => $this->status,
            'photoId' => $this->photo_id === null ? null : (int) $this->photo_id,
            'note' => $this->note,
        ];
    }
}
