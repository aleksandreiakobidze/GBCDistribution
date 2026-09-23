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

    protected function presellerUserId(Request $request): int
    {
        return (int) ($request->attributes->get('presellerUserId') ?: $this->user($request)->id);
    }

    protected function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    /**
     * Validates a request where the listed keys may arrive as one value or as a list.
     *
     * @param  array<string, mixed>  $rules
     * @param  list<string>  $multi
     * @return array<string, mixed>
     */
    protected function validatedWithLists(Request $request, array $rules, array $multi): array
    {
        $input = $request->all();
        foreach ($multi as $key) {
            if (array_key_exists($key, $input) && $input[$key] !== null && ! is_array($input[$key])) {
                $input[$key] = [$input[$key]];
            }
        }

        return validator($input, $rules)->validate();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<int>
     */
    protected function intList(array $data, string $key): array
    {
        return array_values(array_map('intval', array_filter(
            (array) ($data[$key] ?? []),
            fn ($item) => $item !== null && $item !== '',
        )));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<string>
     */
    protected function stringList(array $data, string $key): array
    {
        return array_values(array_map('strval', array_filter(
            (array) ($data[$key] ?? []),
            fn ($item) => $item !== null && $item !== '',
        )));
    }

    protected function pageLimit(Request $request): int
    {
        $default = (int) config('erp.pagination.default', 100);
        $max = (int) config('erp.pagination.max', 500);
        $limit = (int) $request->query('limit', $default);

        return max(1, min($limit, $max));
    }
}
