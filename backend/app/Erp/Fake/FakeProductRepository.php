<?php

namespace App\Erp\Fake;

use App\Erp\Contracts\ProductRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\ItemRecord;
use App\Erp\Dto\PageResult;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\PriceGroupMapping;

final class FakeProductRepository implements ProductRepository
{
    public function __construct(private readonly PriceGroupMapping $mapping)
    {
    }

    public function listForCustomer(int $idGvari, CustomerRecord $customer, ?string $search, ?string $cursor, int $limit, array $filters = []): PageResult
    {
        $mode = (($filters['mode'] ?? 'sale') === 'return') ? 'return' : 'sale';
        if ($mode === 'sale' && ! $customer->orgShowPocket) {
            throw new ErpException(
                'ASSORTMENT_HIDDEN',
                'ეს მომხმარებელი მობილურ კატალოგში არ ჩანს.',
                422,
            );
        }

        $rows = $this->eligible($customer, $search, $filters);
        $this->sortByPriorityThenProdT($rows, $mode === 'sale');

        if ($cursor) {
            $rows = array_values(array_filter($rows, fn ($r) => strcmp((string) $r['IdProd'], $cursor) > 0));
        }

        $slice = array_slice($rows, 0, $limit);
        $hasMore = count($rows) > $limit;
        $next = $hasMore ? (string) $slice[array_key_last($slice)]['IdProd'] : null;

        $withPriority = $mode === 'sale' && $this->hasCompanyCategoryAssortment($customer);

        return new PageResult(
            array_map(fn ($r) => $this->map($r, $customer, $withPriority), $slice),
            $hasMore,
            $next,
        );
    }

    public function getForCustomer(int $idGvari, CustomerRecord $customer, string $itemId, array $filters = []): ItemRecord
    {
        $mode = (($filters['mode'] ?? 'sale') === 'return') ? 'return' : 'sale';
        if ($mode === 'sale' && ! $customer->orgShowPocket) {
            throw new ErpException(
                'ASSORTMENT_HIDDEN',
                'ეს მომხმარებელი მობილურ კატალოგში არ ჩანს.',
                422,
            );
        }

        foreach (FakeErpState::$products as $row) {
            if ((string) $row['IdProd'] === $itemId) {
                if (! $this->isEligibleRow($row, $customer, null, $filters)) {
                    throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
                }

                return $this->map(
                    $row,
                    $customer,
                    $mode === 'sale' && $this->hasCompanyCategoryAssortment($customer),
                );
            }
        }

        throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
    }

    public function listCatalog(array $filters, int $limit): PageResult
    {
        $search = $filters['search'] ?? null;
        $cursor = $filters['cursor'] ?? null;
        $prodS = $filters['prodS'] ?? null;
        $prodT = $filters['prodT'] ?? null;
        $prodG = $filters['prodG'] ?? null;
        $category = $filters['category'] ?? null;

        $rows = array_values(array_filter(
            FakeErpState::$products,
            fn ($row) => $this->isPocketRow($row, $search, $prodT, $prodG, $category, $prodS)
        ));
        $this->sortByProdT($rows);

        if ($cursor) {
            $rows = array_values(array_filter($rows, fn ($r) => strcmp((string) $r['IdProd'], $cursor) > 0));
        }

        $slice = array_slice($rows, 0, $limit);
        $hasMore = count($rows) > $limit;
        $next = $hasMore ? (string) $slice[array_key_last($slice)]['IdProd'] : null;

        return new PageResult(
            array_map(fn ($r) => $this->map($r, null), $slice),
            $hasMore,
            $next,
        );
    }

    public function getCatalogItem(string $itemId): ItemRecord
    {
        foreach (FakeErpState::$products as $row) {
            if ((string) $row['IdProd'] === $itemId) {
                if (! $this->isPocketRow($row, null, null, null, null, null)) {
                    throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
                }

                return $this->map($row, null);
            }
        }

        throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
    }

    public function listCatalogGroups(): array
    {
        $counts = [];
        foreach (FakeErpState::$products as $row) {
            if (! $this->isPocketRow($row, null, null, null, null)) {
                continue;
            }
            $name = (string) ($row['ProdT'] ?? '');
            $counts[$name] = ($counts[$name] ?? 0) + 1;
        }
        ksort($counts);

        $out = [];
        foreach ($counts as $name => $count) {
            $out[] = ['name' => $name, 'count' => $count];
        }

        return $out;
    }

    public function listCatalogTaxonomy(): array
    {
        $byProdS = [];
        foreach (FakeErpState::$products as $row) {
            if (! $this->isPocketRow($row, null, null, null, null, null)) {
                continue;
            }
            $prodS = (string) ($row['ProdS'] ?? '');
            $prodT = (string) ($row['ProdT'] ?? '');
            if (! isset($byProdS[$prodS])) {
                $byProdS[$prodS] = ['name' => $prodS, 'count' => 0, 'types' => []];
            }
            $byProdS[$prodS]['count']++;
            if (! isset($byProdS[$prodS]['types'][$prodT])) {
                $byProdS[$prodS]['types'][$prodT] = ['name' => $prodT, 'count' => 0];
            }
            $byProdS[$prodS]['types'][$prodT]['count']++;
        }
        ksort($byProdS);
        $out = [];
        foreach ($byProdS as $group) {
            $types = array_values($group['types']);
            usort($types, fn ($a, $b) => strcmp($a['name'], $b['name']));
            $out[] = ['name' => $group['name'], 'count' => $group['count'], 'types' => $types];
        }

        return $out;
    }

    /**
     * @param  array{prodS?: ?string, prodT?: ?string, mode?: string}  $filters
     * @return list<array<string, mixed>>
     */
    private function eligible(CustomerRecord $customer, ?string $search, array $filters = []): array
    {
        $rows = array_values(array_filter(
            FakeErpState::$products,
            fn ($row) => $this->isEligibleRow($row, $customer, $search, $filters)
        ));
        foreach ($rows as &$row) {
            $row['_isPriority'] = $this->categoryPriority($customer, (string) $row['IdProd']);
        }
        unset($row);

        return $rows;
    }

    /**
     * @param  array{prodS?: ?string, prodT?: ?string, mode?: string}  $filters
     * @param  array<string, mixed>  $row
     */
    private function isEligibleRow(array $row, CustomerRecord $customer, ?string $search, array $filters = []): bool
    {
        $mode = (($filters['mode'] ?? 'sale') === 'return') ? 'return' : 'sale';
        if ($mode === 'return') {
            if (($row['ShowInPocket'] ?? false) !== true) {
                return false;
            }
        } elseif (($row['Active'] ?? false) !== true) {
            return false;
        }

        if ($this->hasCompanyCategoryAssortment($customer) && ! $this->matchesCategory($customer, (string) $row['IdProd'])) {
            return false;
        }

        return $this->matchesSearchAndTaxonomy(
            $row,
            $search,
            $filters['prodT'] ?? null,
            null,
            null,
            $filters['prodS'] ?? null,
        );
    }

    private function hasCompanyCategoryAssortment(CustomerRecord $customer): bool
    {
        if ($customer->idOrgCompanyCategory <= 0) {
            return false;
        }

        foreach (FakeErpState::$categoryProducts as $link) {
            if ((int) ($link['IdOrgCompanyCategory'] ?? 0) === $customer->idOrgCompanyCategory) {
                return true;
            }
        }

        return false;
    }

    private function matchesCategory(CustomerRecord $customer, string $itemId): bool
    {
        foreach (FakeErpState::$categoryProducts as $link) {
            if (
                (int) ($link['IdOrgCompanyCategory'] ?? 0) === $customer->idOrgCompanyCategory
                && (string) ($link['IdProd'] ?? '') === $itemId
            ) {
                return true;
            }
        }

        return false;
    }

    private function categoryPriority(CustomerRecord $customer, string $itemId): bool
    {
        foreach (FakeErpState::$categoryProducts as $link) {
            if (
                (int) ($link['IdOrgCompanyCategory'] ?? 0) === $customer->idOrgCompanyCategory
                && (string) ($link['IdProd'] ?? '') === $itemId
            ) {
                return (bool) ($link['IsPriority'] ?? false);
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function isPocketRow(array $row, ?string $search, ?string $prodT, ?string $prodG, ?string $category, ?string $prodS = null): bool
    {
        if (($row['Active'] ?? false) !== true) {
            return false;
        }
        if (($row['ShowInPocket'] ?? false) !== true) {
            return false;
        }

        return $this->matchesSearchAndTaxonomy($row, $search, $prodT, $prodG, $category, $prodS);
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function matchesSearchAndTaxonomy(
        array $row,
        ?string $search,
        ?string $prodT,
        ?string $prodG,
        ?string $category,
        ?string $prodS = null,
    ): bool {
        if ($prodS !== null && (string) ($row['ProdS'] ?? '') !== $prodS) {
            return false;
        }
        if ($prodT !== null && (string) ($row['ProdT'] ?? '') !== $prodT) {
            return false;
        }
        if ($prodG !== null && (string) ($row['ProdG'] ?? '') !== $prodG) {
            return false;
        }
        if ($category !== null && (string) ($row['ProdCategory'] ?? '') !== $category) {
            return false;
        }
        if ($search) {
            $hay = mb_strtolower(($row['Prod'] ?? '').' '.($row['ProdCode'] ?? '').' '.($row['IdProd'] ?? ''));
            if (! str_contains($hay, mb_strtolower($search))) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function sortByProdT(array &$rows): void
    {
        $this->sortByPriorityThenProdT($rows, false);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function sortByPriorityThenProdT(array &$rows, bool $priorityFirst): void
    {
        usort($rows, function (array $a, array $b) use ($priorityFirst): int {
            if ($priorityFirst) {
                $pa = (bool) ($a['_isPriority'] ?? false);
                $pb = (bool) ($b['_isPriority'] ?? false);
                if ($pa !== $pb) {
                    return $pa ? -1 : 1;
                }
            }
            $type = strcmp((string) ($a['ProdT'] ?? ''), (string) ($b['ProdT'] ?? ''));
            if ($type !== 0) {
                return $type;
            }
            $name = strcmp((string) ($a['Prod'] ?? ''), (string) ($b['Prod'] ?? ''));
            if ($name !== 0) {
                return $name;
            }

            return strcmp((string) $a['IdProd'], (string) $b['IdProd']);
        });
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function map(array $row, ?CustomerRecord $customer, bool $withPriority = false): ItemRecord
    {
        $unitPrice = null;
        $priceState = 'omitted';
        $priceError = null;

        if ($customer !== null) {
            $priceState = 'unavailable';
            try {
                $unitPrice = $this->mapping->unitPriceFromProduct($row, $customer->priceGroup);
                $priceState = 'list';
            } catch (\InvalidArgumentException) {
                $priceError = 'PRICE_UNAVAILABLE';
            }
        }

        $isPriority = false;
        if ($withPriority && $customer !== null) {
            $isPriority = $this->categoryPriority($customer, (string) $row['IdProd']);
        }

        return new ItemRecord(
            itemId: (string) $row['IdProd'],
            name: (string) ($row['Prod'] ?? ''),
            unit: (string) ($row['Ert'] ?? ''),
            unitName: $row['UnitName'] ?? null,
            prodCode: $row['ProdCode'] ?? null,
            category: $row['ProdCategory'] ?? null,
            prodS: $row['ProdS'] ?? null,
            type: $row['ProdT'] ?? null,
            group: $row['ProdG'] ?? null,
            unitPrice: $unitPrice,
            priceState: $priceState,
            priceError: $priceError,
            active: (bool) ($row['Active'] ?? false),
            showInPocket: (bool) ($row['ShowInPocket'] ?? false),
            compRaod: isset($row['CompRaod']) ? (string) $row['CompRaod'] : null,
            canRealHalfComp: isset($row['CanRealHalfComp']) ? (bool) $row['CanRealHalfComp'] : null,
            isPriority: $isPriority,
        );
    }
}
