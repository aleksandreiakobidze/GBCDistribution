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

    public function listForCustomer(int $idGvari, CustomerRecord $customer, ?string $search, ?string $cursor, int $limit): PageResult
    {
        if ($customer->useProdList) {
            throw new ErpException(
                'ASSORTMENT_UNRESOLVED',
                'ამ მომხმარებლის ასორტიმენტის წყარო FMG-ში დაუდგენელია. კატალოგი არ გაიხსნა.',
                422,
            );
        }

        $rows = $this->eligible($customer, $search);
        usort($rows, fn ($a, $b) => strcmp((string) $a['IdProd'], (string) $b['IdProd']));

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

    /**
     * @return list<array<string, mixed>>
     */
    private function eligible(CustomerRecord $customer, ?string $search): array
    {
        return array_values(array_filter(
            FakeErpState::$products,
            fn ($row) => $this->isEligibleRow($row, $customer, $search)
        ));
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function isEligibleRow(array $row, CustomerRecord $customer, ?string $search): bool
    {
        if (($row['Active'] ?? false) !== true) {
            return false;
        }
        if (($row['ShowInPocket'] ?? false) !== true || ! $customer->orgShowPocket) {
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
     * @param  array<string, mixed>  $row
     */
    private function map(array $row, CustomerRecord $customer): ItemRecord
    {
        $unitPrice = null;
        $priceState = 'unavailable';
        $priceError = null;

        try {
            $unitPrice = $this->mapping->unitPriceFromProduct($row, $customer->priceGroup);
            $priceState = 'list';
        } catch (\InvalidArgumentException) {
            $priceError = 'PRICE_UNAVAILABLE';
        }

        return new ItemRecord(
            itemId: (string) $row['IdProd'],
            name: (string) ($row['Prod'] ?? ''),
            unit: (string) ($row['Ert'] ?? ''),
            unitName: $row['UnitName'] ?? null,
            prodCode: $row['ProdCode'] ?? null,
            category: $row['ProdCategory'] ?? null,
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
