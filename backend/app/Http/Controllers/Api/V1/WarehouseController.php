<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\WarehouseCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WarehouseController extends V1Controller
{
    public function index(Request $request, WarehouseCatalog $warehouses): JsonResponse
    {
        return $this->ok([
            'items' => $warehouses->listForGvari($this->idGvari($request)),
        ]);
    }
}
