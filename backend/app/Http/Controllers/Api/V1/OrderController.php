<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\Exceptions\ErpException;
use App\Erp\OrderApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends V1Controller
{
    public function index(Request $request, OrderApplicationService $orders): JsonResponse
    {
        return $this->ok($orders->listReceipts($this->user($request), $this->idGvari($request)));
    }

    public function quote(Request $request, OrderApplicationService $orders): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['required', 'string'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.itemId' => ['required', 'string'],
            'lines.*.quantity' => ['required'],
        ]);

        return $this->ok($orders->quote($this->user($request), $data['customerId'], $data['lines']));
    }

    public function store(Request $request, OrderApplicationService $orders): JsonResponse
    {
        $data = $request->validate([
            'externalId' => ['required', 'uuid'],
            'customerId' => ['required', 'string'],
            'quoteId' => ['required', 'uuid'],
            'note' => ['nullable', 'string', 'max:300'],
            'location' => ['nullable', 'array'],
            'location.latitude' => ['nullable', 'string'],
            'location.longitude' => ['nullable', 'string'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.itemId' => ['required', 'string'],
            'lines.*.quantity' => ['required'],
        ]);

        return $this->ok($orders->submit($this->user($request), $data), 201);
    }

    public function status(Request $request, string $erpOrderId, OrderApplicationService $orders): JsonResponse
    {
        if ($erpOrderId === '') {
            throw new ErpException('ORDER_NOT_FOUND', 'შეკვეთა ვერ მოიძებნა.', 404);
        }

        return $this->ok($orders->status($this->user($request), $erpOrderId));
    }
}
