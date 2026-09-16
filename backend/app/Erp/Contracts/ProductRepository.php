<?php

namespace App\Erp\Contracts;

use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\ItemRecord;
use App\Erp\Dto\PageResult;

interface ProductRepository
{
    public function listForCustomer(int $idGvari, CustomerRecord $customer, ?string $search, ?string $cursor, int $limit): PageResult;

    public function getForCustomer(int $idGvari, CustomerRecord $customer, string $itemId): ItemRecord;
}
