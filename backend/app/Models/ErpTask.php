<?php

namespace App\Models;

use App\Erp\Support\TbilisiClock;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpTask extends Model
{
    public const STATUS_OPEN = 'open';

    public const STATUS_DONE = 'done';

    protected $fillable = [
        'created_by', 'user_id', 'id_gvari', 'customer_id', 'customer_name', 'photo_id',
        'title', 'note', 'due_on', 'status', 'completed_at', 'checked_by', 'checked_at',
    ];

    protected function casts(): array
    {
        return [
            'due_on' => 'date',
            'completed_at' => 'datetime',
            'checked_at' => 'datetime',
        ];
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
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
            'photoId' => $this->photo_id === null ? null : (int) $this->photo_id,
            'title' => $this->title,
            'note' => $this->note,
            'dueOn' => $this->due_on?->toDateString(),
            'status' => $this->status,
            'completedAt' => TbilisiClock::iso($this->completed_at),
            'checkedAt' => TbilisiClock::iso($this->checked_at),
            'checkedByName' => $this->checker?->name,
        ];
    }
}
