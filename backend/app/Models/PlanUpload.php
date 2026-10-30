<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlanUpload extends Model
{
    protected $fillable = [
        'uploaded_by',
        'original_name',
        'stored_path',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'computed_at' => 'datetime',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PlanLine::class, 'upload_id');
    }

    public function facts(): HasMany
    {
        return $this->hasMany(PlanFact::class, 'upload_id');
    }
}
