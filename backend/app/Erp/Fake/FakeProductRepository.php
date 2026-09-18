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
        if ($customer->useProdList) {
            throw new ErpException(
                'ASSORTMENT_UNRESOLVED',
                'ამ მომხმარებლის ასორტიმენტის წყარო FMG-ში დაუდგენელია. კატალოგი არ გაიხსნა.',
                422,
            );
        }

        $rows = $this->eligible($customer, $search, $filters);
        $this->sortByProdT($rows);

        if ($cursor) {
            $rows = array_values(array_filter($rows, fn ($r) => strcmp((string) $r['IdProd'], $cursor) > 0));
        }

        $slice = array_slice($rows, 0, $limit);
        $hasMore = count($rows) > $limit;
        $next = $hasMore ? (string) $slice[array_key_last($slice)]['IdProd'] : null;

        return new PageResult(
            array_map(fn ($r) => $this->map($r, $customer), $slice),
            $hasMore,
            $next,
        );
    }

    public function getForCustomer(int $idGvari, CustomerRecord $customer, string $itemId): ItemRecord
    {
        if ($customer->useProdList) {
            throw new ErpException(
                'ASSORTMENT_UNRESOLVED',
                'ამ მომხმარებლის ასორტიმენტის წყარო FMG-ში დაუდგენელია. კატალოგი არ გაიხსნა.',
                422,
            );
        }

        foreach (FakeErpState::$products as $row) {
            if ((string) $row['IdProd'] === $itemId) {
                if (! $this->isEligibleRow($row, $customer, null)) {
                    throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
                }

                return $this->map($row, $customer);
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
     * @param  array{prodS?: ?string, prodT?: ?string}  $filters
     * @return list<array<string, mixed>>
     */
    private function eligible(CustomerRecord $customer, ?string $search, array $filters = []): array
    {
        return array_values(array_filter(
            FakeErpState::$products,
            fn ($row) => $this->isEligibleRow($row, $customer, $search, $filters)
        ));
    }

    /**
     * @param  array{prodS?: ?string, prodT?: ?string}  $filters
     * @param  array<string, mixed>  $row
     */
    private function isEligibleRow(array $row, CustomerRecord $customer, ?string $search, array $filters = []): bool
    {
        if (! $this->isPocketRow(
            $row,
            $search,
            $filters['prodT'] ?? null,
            null,
            null,
            $filters['prodS'] ?? null,
        )) {
            return false;
        }

        return $customer->orgShowPocket;
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
        usort($rows, function (array $a, array $b): int {
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
    private function map(array $row, ?CustomerRecord $customer): ItemRecord
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
        );
    }
}
