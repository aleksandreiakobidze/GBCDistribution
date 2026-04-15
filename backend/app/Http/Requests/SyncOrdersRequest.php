<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncOrdersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'orders' => ['required', 'array', 'min:1'],
            'orders.*.customer_id' => ['required', 'exists:customers,id'],
            'orders.*.warehouse_id' => ['required', 'exists:warehouses,id'],
            'orders.*.notes' => ['nullable', 'string'],
            'orders.*.offline_id' => ['nullable', 'string'],
            'orders.*.items' => ['required', 'array', 'min:1'],
            'orders.*.items.*.product_id' => ['required', 'exists:products,id'],
            'orders.*.items.*.quantity' => ['required', 'integer', 'min:1'],
            'orders.*.items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'orders.*.items.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
