<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FieldSetting extends Model
{
    protected $fillable = [
        'require_photo_before',
        'require_photo_end',
        'require_photo_shelf',
        'require_survey',
        'require_shelf_audit',
        'require_gps',
        'missed_skips_rules',
    ];

    protected function casts(): array
    {
        return [
            'require_photo_before' => 'boolean',
            'require_photo_end' => 'boolean',
            'require_photo_shelf' => 'boolean',
            'require_survey' => 'boolean',
            'require_shelf_audit' => 'boolean',
            'require_gps' => 'boolean',
            'missed_skips_rules' => 'boolean',
        ];
    }

    public static function current(): self
    {
        $row = static::query()->first();
        if ($row) {
            return $row;
        }

        return static::query()->create([
            'missed_skips_rules' => true,
        ]);
    }

    /**
     * @return array<string, bool>
     */
    public function toApiArray(): array
    {
        return [
            'requirePhotoBefore' => (bool) $this->require_photo_before,
            'requirePhotoEnd' => (bool) $this->require_photo_end,
            'requirePhotoShelf' => (bool) $this->require_photo_shelf,
            'requireSurvey' => (bool) $this->require_survey,
            'requireShelfAudit' => (bool) $this->require_shelf_audit,
            'requireGps' => (bool) $this->require_gps,
            'missedSkipsRules' => (bool) $this->missed_skips_rules,
        ];
    }
}
