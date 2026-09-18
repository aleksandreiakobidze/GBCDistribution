<?php

namespace App\Http\Controllers\Api;

use App\Enums\DeliveryStatus;
use App\Http\Resources\DeliveryResource;
use App\Models\Delivery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = Delivery::with(['order.customer', 'driver']);

        if ($request->user()->role === \App\Enums\UserRole::Driver) {
            $query->where('driver_id', $request->user()->id);
        }

        $deliveries = $query->latest()->paginate(20);

        return $this->sendResponse(
            DeliveryResource::collection($deliveries)->response()->getData(true),
            'Deliveries retrieved successfully.'
        );
    }

    public function show(int $id): JsonResponse
    {
        $delivery = Delivery::with(['order.customer', 'order.items.product', 'driver'])->findOrFail($id);

        return $this->sendResponse(
            new DeliveryResource($delivery),
            'Delivery retrieved successfully.'
        );
    }

    public function updateStatus(int $id, Request $request): JsonResponse
    {
        $rules = [
            'status' => ['required', 'string'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];

        if ($request->status === DeliveryStatus::Failed->value) {
            $rules['notes'] = ['required', 'string', 'max:1000'];
        }

        $request->validate($rules);

        $delivery = Delivery::findOrFail($id);
        $newStatus = DeliveryStatus::from($request->status);

        $updateData = [
            'status' => $newStatus,
            'delivered_at' => $newStatus === DeliveryStatus::Delivered ? now() : $delivery->delivered_at,
        ];

        if ($request->filled('notes')) {
            $updateData['notes'] = $request->notes;
        }

        $delivery->update($updateData);

        return $this->sendResponse(
            new DeliveryResource($delivery->fresh(['order', 'driver'])),
            'Delivery status updated successfully.'
        );
    }

    public function uploadPod(int $id, Request $request): JsonResponse
    {
        $request->validate([
            'signature_image' => ['nullable', 'image', 'max:5120'],
            'delivery_photo' => ['nullable', 'image', 'max:5120'],
        ]);

        $delivery = Delivery::findOrFail($id);
        $updateData = [];

        if ($request->hasFile('signature_image')) {
            $updateData['signature_image'] = $request->file('signature_image')
                ->store('deliveries/signatures', 'public');
        }

        if ($request->hasFile('delivery_photo')) {
            $updateData['delivery_photo'] = $request->file('delivery_photo')
                ->store('deliveries/photos', 'public');
        }

        if (!empty($updateData)) {
            $delivery->update($updateData);
        }

        return $this->sendResponse(
            new DeliveryResource($delivery->fresh()),
            'Proof of delivery uploaded successfully.'
        );
    }
}
