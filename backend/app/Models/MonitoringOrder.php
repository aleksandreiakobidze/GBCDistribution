<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MonitoringOrder extends Model
{
    protected $fillable = [
        'user_id',
        'sales_user_id',
        'sales_name',
        'id_org',
        'org_name',
        'legal_address',
        'user_name',
        'system_debt',
        'actual_debt',
    ];

    protected function casts(): array
    {
        return [
            'system_debt' => 'float',
            'actual_debt' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(MonitoringOrderLine::class)->orderBy('sort_order');
    }
}
