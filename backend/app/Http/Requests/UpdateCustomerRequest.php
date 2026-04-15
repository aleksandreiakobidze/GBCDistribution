<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'contact_person' => ['sometimes', 'string'],
            'phone' => ['sometimes', 'string'],
            'email' => ['nullable', 'email'],
            'address' => ['sometimes', 'string'],
            'city' => ['sometimes', 'string'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'category' => ['sometimes', 'in:A,B,C'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'assigned_sales_rep_id' => ['nullable', 'exists:users,id'],
        ];
    }
}
