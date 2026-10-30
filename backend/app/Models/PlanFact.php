<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanFact extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'upload_id',
        'presale_key',
        'supervisor_key',
        'channel_key',
        'category_key',
        'brand_key',
        'starts_on',
        'ends_on',
        'real_amount',
        'return_amount',
    ];

    protected function casts(): array
    {
        return [
            'real_amount' => 'float',
            'return_amount' => 'float',
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function upload(): BelongsTo
    {
        return $this->belongsTo(PlanUpload::class, 'upload_id');
    }
}
