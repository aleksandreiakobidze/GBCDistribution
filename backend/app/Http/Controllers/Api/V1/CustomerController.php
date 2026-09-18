<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\Contracts\ErpProvider;
use App\Erp\Support\VisitDay;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends V1Controller
{
    public function index(Request $request, ErpProvider $erp): JsonResponse
    {
        $day = VisitDay::normalize($request->query('day'));
        $page = $erp->customers()->listForPreseller(
            $this->idGvari($request),
            $request->query('search'),
            $day === 'today' ? null : $request->query('cursor'),
            $this->pageLimit($request),
            $day,
        );

        return $this->ok($page->toArray());
    }

    public function show(Request $request, string $customerId, ErpProvider $erp): JsonResponse
    {
        $customer = $erp->customers()->getAuthorized($this->idGvari($request), $customerId);

        return $this->ok($customer->toArray());
    }
}
