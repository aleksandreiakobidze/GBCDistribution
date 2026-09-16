<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\Contracts\ErpProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends V1Controller
{
    public function __invoke(Request $request, ErpProvider $erp): JsonResponse
    {
        $user = $this->user($request);

        return $this->ok([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'presellerId' => $user->id_gvari !== null ? (string) $user->id_gvari : null,
            'presellerMapped' => $user->id_gvari !== null,
            'provider' => $erp->name(),
        ]);
    }
}
