<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\VisitDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductReturnController extends V1Controller
{
    public function index(Request $request, VisitDocumentService $docs): JsonResponse
    {
        $customerId = (string) $request->query('customerId', '');

        return $this->ok($docs->listReturns(
            $this->user($request),
            $this->idGvari($request),
            $customerId === '' ? null : $customerId,
        ));
    }

    public function store(Request $request, VisitDocumentService $docs): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['required', 'string'],
            'note' => ['nullable', 'string', 'max:300'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.itemId' => ['required', 'string'],
            'lines.*.quantity' => ['required'],
            'lines.*.reason' => ['required', 'string'],
        ]);

        return $this->ok($docs->createReturn($this->user($request), $this->idGvari($request), $data), 201);
    }

    public function show(Request $request, int $id, VisitDocumentService $docs): JsonResponse
    {
        return $this->ok($docs->getReturn($this->user($request), $this->idGvari($request), $id));
    }

    public function update(Request $request, int $id, VisitDocumentService $docs): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['nullable', 'string'],
            'note' => ['nullable', 'string', 'max:300'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.itemId' => ['required', 'string'],
            'lines.*.quantity' => ['required'],
            'lines.*.reason' => ['required', 'string'],
        ]);

        return $this->ok($docs->updateReturn($this->user($request), $this->idGvari($request), $id, $data));
    }
}
