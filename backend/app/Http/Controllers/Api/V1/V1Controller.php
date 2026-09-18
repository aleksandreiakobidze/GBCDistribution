<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class V1Controller extends Controller
{
    protected function ok(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'correlationId' => request()->attributes->get('correlationId'),
        ], $status);
    }

    protected function idGvari(Request $request): int
    {
        return (int) $request->attributes->get('idGvari');
    }

    protected function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    protected function pageLimit(Request $request): int
    {
        $default = (int) config('erp.pagination.default', 100);
        $max = (int) config('erp.pagination.max', 500);
        $limit = (int) $request->query('limit', $default);

        return max(1, min($limit, $max));
    }
}
