<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\Plan\PlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanController extends V1Controller
{
    public function show(Request $request, PlanService $plans): JsonResponse
    {
        return $this->ok($plans->show($this->user($request), [
            'region' => $this->listQuery($request, 'region'),
            'supervisor' => $this->listQuery($request, 'supervisor'),
            'presale' => $request->query('presale', ''),
            'presaleChosen' => (string) $request->query('presaleChosen', ''),
            'channel' => $this->listQuery($request, 'channel'),
            'category' => $this->listQuery($request, 'category'),
            'brand' => $this->listQuery($request, 'brand'),
        ]));
    }

    public function store(Request $request, PlanService $plans): JsonResponse
    {
        $file = $request->file('file');
        if (! $file) {
            return response()->json([
                'success' => false,
                'code' => 'PLAN_FILE',
                'message' => 'Excel ფაილი აუცილებელია.',
            ], 422);
        }

        return $this->ok($plans->store($this->user($request), $file));
    }

    public function refresh(Request $request, PlanService $plans): JsonResponse
    {
        return $this->ok($plans->refresh($this->user($request)));
    }

    /**
     * @return list<string>
     */
    private function listQuery(Request $request, string $key): array
    {
        $value = $request->query($key, []);
        if (is_string($value)) {
            $value = $value === '' ? [] : [$value];
        }
        if (! is_array($value)) {
            return [];
        }
        $items = [];
        foreach ($value as $item) {
            if (is_string($item) && trim($item) !== '') {
                $items[] = $item;
            }
        }

        return array_values($items);
    }
}
