<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\StoreCustomerVisitRequest;
use App\Http\Resources\CustomerVisitResource;
use App\Models\CustomerVisit;
use Illuminate\Http\JsonResponse;

class CustomerVisitController extends BaseController
{
    public function store(StoreCustomerVisitRequest $request): JsonResponse
    {
        $visit = CustomerVisit::create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
            'visited_at' => now(),
        ]);

        $visit->load(['customer', 'user']);

        return $this->sendResponse(
            new CustomerVisitResource($visit),
            'Customer visit recorded successfully.',
            201
        );
    }
}
