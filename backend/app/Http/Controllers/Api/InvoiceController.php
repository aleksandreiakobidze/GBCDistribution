<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentStatus;
use App\Http\Requests\StorePaymentRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InvoiceController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['customer', 'order']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $invoices = $query->latest()->paginate(20);

        return $this->sendResponse(
            InvoiceResource::collection($invoices)->response()->getData(true),
            'Invoices retrieved successfully.'
        );
    }

    public function show(int $id): JsonResponse
    {
        $invoice = Invoice::with(['customer', 'order', 'payments.receivedBy'])
            ->findOrFail($id);

        return $this->sendResponse(
            new InvoiceResource($invoice),
            'Invoice retrieved successfully.'
        );
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);

        $data = $request->validate([
            'invoice_number' => ['sometimes', 'string', 'max:64'],
            'amount' => ['sometimes', 'numeric', 'min:0'],
            'due_date' => ['sometimes', 'date'],
            'status' => ['sometimes', Rule::enum(PaymentStatus::class)],
        ]);

        if (isset($data['amount']) && ! isset($data['status'])) {
            $paid = (float) $invoice->paid_amount;
            $amount = (float) $data['amount'];
            if ($paid <= 0) {
                $data['status'] = $invoice->status === PaymentStatus::Draft
                    ? PaymentStatus::Draft
                    : PaymentStatus::Sent;
            } elseif ($paid >= $amount) {
                $data['status'] = PaymentStatus::Paid;
            } else {
                $data['status'] = PaymentStatus::Partial;
            }
        }

        $invoice->update($data);

        return $this->sendResponse(
            new InvoiceResource($invoice->fresh(['customer', 'order', 'payments.receivedBy'])),
            'Invoice updated successfully.'
        );
    }

    public function recordPayment(int $id, StorePaymentRequest $request): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);

        $payment = DB::transaction(function () use ($invoice, $request) {
            $payment = Payment::create([
                'invoice_id' => $invoice->id,
                'amount' => $request->amount,
                'method' => $request->method,
                'paid_at' => now(),
                'reference' => $request->reference,
                'received_by' => $request->user()->id,
            ]);

            $newPaidAmount = $invoice->paid_amount + $request->amount;
            $invoice->update([
                'paid_amount' => $newPaidAmount,
                'status' => $newPaidAmount >= $invoice->amount
                    ? PaymentStatus::Paid
                    : PaymentStatus::Partial,
            ]);

            return $payment;
        });

        return $this->sendResponse(
            new InvoiceResource($invoice->fresh(['customer', 'order', 'payments.receivedBy'])),
            'Payment recorded successfully.',
            201
        );
    }
}
