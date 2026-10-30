<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\Contracts\ErpProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends V1Controller
{
    public function index(Request $request, ErpProvider $erp): JsonResponse
    {
        $customerId = (string) $request->query('customerId', '');
        if ($customerId === '') {
            $page = $erp->products()->listCatalog([
                'search' => $request->query('search'),
                'cursor' => $request->query('cursor'),
                'prodS' => $request->query('prodS'),
                'prodT' => $request->query('prodT'),
                'prodG' => $request->query('prodG'),
                'category' => $request->query('category'),
            ], $this->pageLimit($request));

            return $this->ok($page->toArray());
        }

        $idGvari = $this->idGvari($request);
        $customer = $erp->customers()->getAuthorized($idGvari, $customerId);
        $mode = (string) $request->query('mode', 'sale') === 'return' ? 'return' : 'sale';
        $page = $erp->products()->listForCustomer(
            $idGvari,
            $customer,
            $request->query('search'),
            $request->query('cursor'),
            $this->pageLimit($request),
            [
                'prodS' => $request->query('prodS'),
                'prodT' => $request->query('prodT'),
                'mode' => $mode,
            ],
        );

        return $this->ok($page->toArray());
    }

    public function groups(ErpProvider $erp): JsonResponse
    {
        return $this->ok($erp->products()->listCatalogGroups());
    }

    public function taxonomy(ErpProvider $erp): JsonResponse
    {
        return $this->ok($erp->products()->listCatalogTaxonomy());
    }

    public function show(Request $request, string $itemId, ErpProvider $erp): JsonResponse
    {
        $customerId = (string) $request->query('customerId', '');
        if ($customerId === '') {
            return $this->ok($erp->products()->getCatalogItem($itemId)->toArray());
        }

        $idGvari = $this->idGvari($request);
        $customer = $erp->customers()->getAuthorized($idGvari, $customerId);
        $mode = (string) $request->query('mode', 'sale') === 'return' ? 'return' : 'sale';
        $item = $erp->products()->getForCustomer($idGvari, $customer, $itemId, ['mode' => $mode]);

        return $this->ok($item->toArray());
    }
}
