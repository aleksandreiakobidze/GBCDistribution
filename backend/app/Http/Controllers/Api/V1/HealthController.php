<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\Contracts\ErpProvider;
use App\Enums\UserRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HealthController extends V1Controller
{
    public function invoke(ErpProvider $erp): JsonResponse
    {
        return $this->ok([
            'status' => 'ok',
            'provider' => $erp->name(),
        ]);
    }

    public function diagnostics(Request $request, ErpProvider $erp): JsonResponse
    {
        $user = $this->user($request);
        if ($user->role !== UserRole::Admin) {
            abort(403);
        }

        $health = $erp->health();

        return $this->ok([
            'provider' => $erp->name(),
            'sql' => $health,
            'writesEnabled' => (bool) config('erp.writes_enabled'),
            'timezone' => config('erp.timezone'),
        ]);
    }
}
