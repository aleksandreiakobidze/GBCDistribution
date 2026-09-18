<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\Contracts\ErpProvider;
use App\Erp\Exceptions\ErpException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PromotionController extends V1Controller
{
    public function index(Request $request, ErpProvider $erp): JsonResponse
    {
        $customerId = (string) $request->query('customerId', '');
        if ($customerId === '') {
            throw new ErpException('CUSTOMER_REQUIRED', 'მომხმარებელი აუცილებელია.', 400);
        }

        $idGvari = $this->idGvari($request);
        $customer = $erp->customers()->getAuthorized($idGvari, $customerId);
        $promos = $erp->promotions()->listIndicative($customer, now(config('erp.timezone')));

        return $this->ok([
            'state' => 'indicative',
            'items' => $promos,
        ]);
    }
}
