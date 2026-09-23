<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpShelfAuditLine extends Model
{
    public const PRESENT = 'present';

    public const MISSING = 'missing';

    public const LOW = 'low';

    public $timestamps = false;

    protected $fillable = ['audit_id', 'item_id', 'item_name', 'status'];

    public function audit(): BelongsTo
    {
        return $this->belongsTo(ErpShelfAudit::class, 'audit_id');
    }
}
