<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use App\Erp\Support\RoleMenus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $role = $this->role;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $role,
            'id_gvari' => $this->id_gvari,
            'presellerMapped' => $this->id_gvari !== null,
            'avatar' => $this->avatar,
            'is_active' => $this->is_active,
            'menus' => RoleMenus::forRole($role instanceof UserRole ? $role->value : (string) $role),
        ];
    }
}
