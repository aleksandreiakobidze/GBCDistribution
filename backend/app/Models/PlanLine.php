<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanLine extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'upload_id',
        'region',
        'supervisor',
        'presale',
        'channel',
        'category',
        'brand',
        'plan_amount',
        'starts_on',
        'ends_on',
    ];

    protected function casts(): array
    {
        return [
            'plan_amount' => 'float',
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function upload(): BelongsTo
    {
        return $this->belongsTo(PlanUpload::class, 'upload_id');
    }
}
