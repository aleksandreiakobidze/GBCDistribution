<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\FieldVisitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VisitController extends V1Controller
{
    public function index(Request $request, FieldVisitService $visits): JsonResponse
    {
        $customerId = (string) $request->query('customerId', '');
        $todayOnly = (string) $request->query('day', '') === 'today';

        return $this->ok($visits->list(
            $this->presellerUserId($request),
            $customerId === '' ? null : $customerId,
            $todayOnly,
        ));
    }

    public function store(Request $request, FieldVisitService $visits): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['required', 'string'],
            'latitude' => ['nullable'],
            'longitude' => ['nullable'],
        ]);

        return $this->ok($visits->start(
            $this->user($request),
            $this->presellerUserId($request),
            $this->idGvari($request),
            $data,
        ), 201);
    }

    public function update(Request $request, int $id, FieldVisitService $visits): JsonResponse
    {
        $data = $request->validate([
            'outcome' => ['required', 'string'],
            'latitude' => ['nullable'],
            'longitude' => ['nullable'],
        ]);

        return $this->ok($visits->finish(
            $this->user($request),
            $this->presellerUserId($request),
            $id,
            $data,
        ));
    }
}
