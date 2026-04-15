<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'contact_person' => ['required', 'string'],
            'phone' => ['required', 'string'],
            'email' => ['nullable', 'email'],
            'address' => ['required', 'string'],
            'city' => ['required', 'string'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'category' => ['required', 'in:A,B,C'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'assigned_sales_rep_id' => ['nullable', 'exists:users,id'],
        ];
    }
}
