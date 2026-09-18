<?php

namespace App\Erp\Contracts;

use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\ItemRecord;
use App\Erp\Dto\PageResult;

interface ProductRepository
{
    /**
     * @param  array{prodS?: ?string, prodT?: ?string}  $filters
     */
    public function listForCustomer(int $idGvari, CustomerRecord $customer, ?string $search, ?string $cursor, int $limit, array $filters = []): PageResult;

    public function getForCustomer(int $idGvari, CustomerRecord $customer, string $itemId): ItemRecord;

    /**
     * Pocket catalog without customer prices (Active + ShowInPocket).
     *
     * @param  array{search?: ?string, cursor?: ?string, prodS?: ?string, prodT?: ?string, prodG?: ?string, category?: ?string}  $filters
     */
    public function listCatalog(array $filters, int $limit): PageResult;

    public function getCatalogItem(string $itemId): ItemRecord;

    /**
     * @return list<array{name: string, count: int}>
     */
    public function listCatalogGroups(): array;

    /**
     * Pocket ProdS → ProdT hierarchy for compact filters.
     *
     * @return list<array{name: string, count: int, types: list<array{name: string, count: int}>}>
     */
    public function listCatalogTaxonomy(): array;
}
