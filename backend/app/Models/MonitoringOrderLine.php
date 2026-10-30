<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringOrderLine extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'monitoring_order_id',
        'source',
        'id_prod',
        'name',
        'system_qty',
        'actual_qty',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'system_qty' => 'float',
            'actual_qty' => 'float',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(MonitoringOrder::class, 'monitoring_order_id');
    }
}
