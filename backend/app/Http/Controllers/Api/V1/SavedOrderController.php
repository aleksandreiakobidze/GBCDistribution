<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\OrderApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SavedOrderController extends V1Controller
{
    public function index(Request $request, OrderApplicationService $orders): JsonResponse
    {
        return $this->ok($orders->listSaved($this->user($request), $this->idGvari($request)));
    }

    public function show(Request $request, int $id, OrderApplicationService $orders): JsonResponse
    {
        return $this->ok($orders->getSaved($this->user($request), $this->idGvari($request), $id));
    }

    public function store(Request $request, OrderApplicationService $orders): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['required', 'string'],
            'note' => ['nullable', 'string', 'max:300'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.itemId' => ['required', 'string'],
            'lines.*.quantity' => ['required'],
        ]);

        return $this->ok($orders->saveLocal($this->user($request), $data), 201);
    }

    public function update(Request $request, int $id, OrderApplicationService $orders): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['nullable', 'string'],
            'note' => ['nullable', 'string', 'max:300'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.itemId' => ['required', 'string'],
            'lines.*.quantity' => ['required'],
        ]);

        return $this->ok($orders->updateSaved($this->user($request), $id, $data));
    }
}
