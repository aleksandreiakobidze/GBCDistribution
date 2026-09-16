<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\Contracts\ErpProvider;
use App\Erp\Exceptions\ErpException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends V1Controller
{
    public function index(Request $request, ErpProvider $erp): JsonResponse
    {
        $customerId = (string) $request->query('customerId', '');
        if ($customerId === '') {
            throw new ErpException('CUSTOMER_REQUIRED', 'მომხმარებელი აუცილებელია პროდუქტების სანახავად.', 400);
        }

        $idGvari = $this->idGvari($request);
        $customer = $erp->customers()->getAuthorized($idGvari, $customerId);
        $page = $erp->products()->listForCustomer(
            $idGvari,
            $customer,
            $request->query('search'),
            $request->query('cursor'),
            $this->pageLimit($request),
        );

        return $this->ok($page->toArray());
    }

    public function show(Request $request, string $itemId, ErpProvider $erp): JsonResponse
    {
        $customerId = (string) $request->query('customerId', '');
        if ($customerId === '') {
            throw new ErpException('CUSTOMER_REQUIRED', 'მომხმარებელი აუცილებელია პროდუქტის სანახავად.', 400);
        }

        $idGvari = $this->idGvari($request);
        $customer = $erp->customers()->getAuthorized($idGvari, $customerId);
        $item = $erp->products()->getForCustomer($idGvari, $customer, $itemId);

        return $this->ok($item->toArray());
    }
}
