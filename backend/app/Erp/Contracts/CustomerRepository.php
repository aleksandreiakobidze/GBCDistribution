<?php

namespace App\Erp\Contracts;

use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\PageResult;

interface CustomerRepository
{
    public function listForPreseller(int $idGvari, ?string $search, ?string $cursor, int $limit, string $day = 'all'): PageResult;

    public function getAuthorized(int $idGvari, string $customerId): CustomerRecord;

    public function isAssigned(int $idGvari, string $customerId): bool;

    public function isPresellerActive(int $idGvari): bool;
}
