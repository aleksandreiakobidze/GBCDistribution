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

    protected $fillable = [
        'audit_id', 'item_id', 'item_name', 'status',
        'shelf_no', 'facings', 'read_price',
        'box_x', 'box_y', 'box_w', 'box_h', 'competitor',
    ];

    protected $casts = [
        'shelf_no' => 'integer',
        'facings' => 'integer',
        'read_price' => 'float',
        'box_x' => 'float',
        'box_y' => 'float',
        'box_w' => 'float',
        'box_h' => 'float',
        'competitor' => 'boolean',
    ];

    public function audit(): BelongsTo
    {
        return $this->belongsTo(ErpShelfAudit::class, 'audit_id');
    }
}
