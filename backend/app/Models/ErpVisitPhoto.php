<?php

namespace App\Models;

use App\Erp\Support\TbilisiClock;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpVisitPhoto extends Model
{
    public const PHASE_BEFORE = 'before';

    public const PHASE_END = 'end';

    public const PHASE_SURVEY = 'survey';

    public const PHASE_SHELF = 'shelf';

    protected $fillable = [
        'user_id',
        'id_gvari',
        'customer_id',
        'customer_name',
        'visit_id',
        'phase',
        'comment',
        'tags',
        'signature',
        'review_comment',
        'rating',
        'rotation',
        'reviewed_at',
        'reviewed_by',
        'taken_at',
        'latitude',
        'longitude',
        'path',
        'mime',
    ];

    protected function casts(): array
    {
        return [
            'taken_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'tags' => 'array',
            'rating' => 'integer',
            'rotation' => 'integer',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(ErpVisit::class, 'visit_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * @return array{id: int, customerId: string, customerName: string|null, visitId: int|null, phase: string, comment: string|null, tags: list<string>, takenAt: string|null, latitude: string|null, longitude: string|null}
     */
    public function toApiArray(): array
    {
        $tags = is_array($this->tags) ? array_values($this->tags) : [];

        return [
            'id' => $this->id,
            'customerId' => (string) $this->customer_id,
            'customerName' => $this->customer_name,
            'visitId' => $this->visit_id === null ? null : (int) $this->visit_id,
            'phase' => (string) $this->phase,
            'comment' => $this->comment,
            'tags' => $tags,
            'takenAt' => TbilisiClock::iso($this->taken_at),
            'latitude' => $this->latitude === null ? null : (string) $this->latitude,
            'longitude' => $this->longitude === null ? null : (string) $this->longitude,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toGalleryArray(): array
    {
        $stored = $this->signature;
        $signature = ($stored === null || $stored === '') ? $this->customer_name : $stored;

        return [
            ...$this->toApiArray(),
            'salesUserId' => (int) $this->user_id,
            'salesName' => $this->user?->name,
            'signature' => $signature,
            'reviewComment' => $this->review_comment,
            'rating' => $this->rating === null ? null : (int) $this->rating,
            'rotation' => (int) ($this->rotation ?? 0),
            'reviewedAt' => TbilisiClock::iso($this->reviewed_at),
            'reviewedByName' => $this->reviewer?->name,
        ];
    }
}
