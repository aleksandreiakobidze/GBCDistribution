<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Requests\StoreCustomerRequest;
use App\Http\Requests\UpdateCustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = Customer::query();

        if ($request->user()->role === UserRole::SalesRep) {
            $query->where('assigned_sales_rep_id', $request->user()->id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $customers = $query->paginate(20);

        return $this->sendResponse(
            CustomerResource::collection($customers)->response()->getData(true),
            'Customers retrieved successfully.'
        );
    }

    public function show(int $id): JsonResponse
    {
        $customer = Customer::with(['assignedSalesRep'])
            ->withCount('orders')
            ->findOrFail($id);

        $customer->load(['orders' => function ($q) {
            $q->latest()->limit(10);
        }]);

        return $this->sendResponse(
            new CustomerResource($customer),
            'Customer retrieved successfully.'
        );
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $customer = Customer::create($request->validated());

        return $this->sendResponse(
            new CustomerResource($customer),
            'Customer created successfully.',
            201
        );
    }

    public function update(UpdateCustomerRequest $request, int $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);
        $customer->update($request->validated());

        return $this->sendResponse(
            new CustomerResource($customer->fresh()),
            'Customer updated successfully.'
        );
    }
}
