<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Erp\Contracts\ErpProvider;
use App\Erp\Support\RoleMenus;
use App\Models\FieldSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends V1Controller
{
    public function __invoke(Request $request, ErpProvider $erp): JsonResponse
    {
        $user = $this->user($request);
        $role = $user->role;

        return $this->ok([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $role,
            'presellerId' => $user->id_gvari !== null ? (string) $user->id_gvari : null,
            'presellerMapped' => $user->id_gvari !== null,
            'provider' => $erp->name(),
            'fieldRules' => FieldSetting::current()->toApiArray(),
            'menus' => RoleMenus::forRole($role instanceof UserRole ? $role->value : (string) $role),
        ]);
    }
}
