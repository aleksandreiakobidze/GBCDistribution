<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Models\FieldSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FieldSettingsController extends V1Controller
{
    public function show(Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        return $this->ok(FieldSetting::current()->toApiArray());
    }

    public function update(Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        $data = $request->validate([
            'requirePhotoBefore' => ['required', 'boolean'],
            'requirePhotoEnd' => ['required', 'boolean'],
            'requirePhotoShelf' => ['required', 'boolean'],
            'requireSurvey' => ['required', 'boolean'],
            'requireShelfAudit' => ['required', 'boolean'],
            'requireGps' => ['required', 'boolean'],
            'missedSkipsRules' => ['required', 'boolean'],
        ]);

        FieldSetting::current()->update([
            'require_photo_before' => $data['requirePhotoBefore'],
            'require_photo_end' => $data['requirePhotoEnd'],
            'require_photo_shelf' => $data['requirePhotoShelf'],
            'require_survey' => $data['requireSurvey'],
            'require_shelf_audit' => $data['requireShelfAudit'],
            'require_gps' => $data['requireGps'],
            'missed_skips_rules' => $data['missedSkipsRules'],
        ]);

        return $this->ok(FieldSetting::current()->fresh()->toApiArray());
    }

    private function assertAdmin(Request $request): void
    {
        if ($this->user($request)->role !== UserRole::Admin) {
            abort(403);
        }
    }
}
