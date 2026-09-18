<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role,
            'id_gvari' => $this->id_gvari,
            'presellerMapped' => $this->id_gvari !== null,
            'avatar' => $this->avatar,
            'is_active' => $this->is_active,
        ];
    }
}
