<?php

namespace App\Models;

use App\Erp\Support\TbilisiClock;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpVisit extends Model
{
    public const STATUS_OPEN = 'open';

    public const STATUS_ARRIVED = 'arrived';

    public const STATUS_MISSED = 'missed';

    protected $fillable = [
        'user_id',
        'id_gvari',
        'customer_id',
        'customer_name',
        'status',
        'started_at',
        'ended_at',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array{id: int, customerId: string, customerName: string|null, status: string, startedAt: string|null, endedAt: string|null, latitude: string|null, longitude: string|null}
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'customerId' => (string) $this->customer_id,
            'customerName' => $this->customer_name,
            'status' => (string) $this->status,
            'startedAt' => TbilisiClock::iso($this->started_at),
            'endedAt' => TbilisiClock::iso($this->ended_at),
            'latitude' => $this->latitude === null ? null : (string) $this->latitude,
            'longitude' => $this->longitude === null ? null : (string) $this->longitude,
        ];
    }
}
