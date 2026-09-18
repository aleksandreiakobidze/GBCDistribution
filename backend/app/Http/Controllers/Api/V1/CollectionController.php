<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\VisitDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CollectionController extends V1Controller
{
    public function index(Request $request, VisitDocumentService $docs): JsonResponse
    {
        $customerId = (string) $request->query('customerId', '');

        return $this->ok($docs->listCollections(
            $this->user($request),
            $this->idGvari($request),
            $customerId === '' ? null : $customerId,
        ));
    }

    public function store(Request $request, VisitDocumentService $docs): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['required', 'string'],
            'amount' => ['required'],
            'method' => ['nullable', 'string'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);

        return $this->ok($docs->collect($this->user($request), $this->idGvari($request), $data), 201);
    }

    public function show(Request $request, int $id, VisitDocumentService $docs): JsonResponse
    {
        return $this->ok($docs->getCollection($this->user($request), $this->idGvari($request), $id));
    }

    public function update(Request $request, int $id, VisitDocumentService $docs): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['sometimes'],
            'method' => ['nullable', 'string'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);

        return $this->ok($docs->updateCollection($this->user($request), $this->idGvari($request), $id, $data));
    }
}
