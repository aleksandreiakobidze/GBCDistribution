<?php

namespace App\Erp\Fmg;

use App\Erp\Contracts\ProductRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\ItemRecord;
use App\Erp\Dto\PageResult;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\Decimal;
use App\Erp\Support\PriceGroupMapping;

final class FmgProductRepository implements ProductRepository
{
    public function __construct(
        private readonly FmgConnection $fmg,
        private readonly PriceGroupMapping $mapping,
    ) {
    }

    public function listForCustomer(int $idGvari, CustomerRecord $customer, ?string $search, ?string $cursor, int $limit): PageResult
    {
        $this->assertAssortment($customer);

        if (! $this->mapping->isValid($customer->priceGroup)) {
            throw new ErpException('PRICE_GROUP_UNMAPPED', 'ამ მომხმარებლის ფასების ჯგუფი არ არის დაშვებული.', 422);
        }

        $priceExpr = $this->mapping->sqlCaseExpression('p', ':fg');
        $limitPlus = max(1, min($limit + 1, 501));
        $sql = <<<SQL
SELECT TOP {$limitPlus}
    p.IdProd, p.Prod, p.Ert, p.UnitName, p.ProdCode, p.ProdCategory,
    p.Active, p.ShowInPocket, p.CompRaod, p.CanRealHalfComp,
    {$priceExpr} AS UnitPrice
FROM dbo.ProdView AS p
WHERE p.Active = 1
  AND p.ShowInPocket = 1
SQL;

        $bindings = [
            'fg' => $customer->priceGroup,
        ];

        if ($cursor) {
            $sql .= ' AND p.IdProd > :cursor';
            $bindings['cursor'] = $cursor;
        }

        if ($search) {
            $sql .= ' AND (p.Prod LIKE :search OR p.ProdCode LIKE :search2 OR p.IdProd LIKE :search3)';
            $like = '%'.$search.'%';
            $bindings['search'] = $like;
            $bindings['search2'] = $like;
            $bindings['search3'] = $like;
        }

        $sql .= ' ORDER BY p.IdProd';

        try {
            $rows = $this->fmg->connection()->select($sql, $bindings);
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        $hasMore = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);
        $items = array_map(fn ($row) => $this->map((array) $row), $rows);
        $next = $hasMore && $items !== [] ? $items[array_key_last($items)]->itemId : null;

        return new PageResult($items, $hasMore, $next);
    }

    public function getForCustomer(int $idGvari, CustomerRecord $customer, string $itemId): ItemRecord
    {
        $this->assertAssortment($customer);

        if (! $this->mapping->isValid($customer->priceGroup)) {
            throw new ErpException('PRICE_GROUP_UNMAPPED', 'ამ მომხმარებლის ფასების ჯგუფი არ არის დაშვებული.', 422);
        }

        $priceExpr = $this->mapping->sqlCaseExpression('p', ':fg');
        $sql = <<<SQL
SELECT
    p.IdProd, p.Prod, p.Ert, p.UnitName, p.ProdCode, p.ProdCategory,
    p.Active, p.ShowInPocket, p.CompRaod, p.CanRealHalfComp,
    {$priceExpr} AS UnitPrice
FROM dbo.ProdView AS p
WHERE p.IdProd = :idProd
SQL;

        try {
            $rows = $this->fmg->connection()->select($sql, [
                'fg' => $customer->priceGroup,
                'idProd' => $itemId,
            ]);
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        if ($rows === []) {
            throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
        }

        $row = (array) $rows[0];
        if (($row['Active'] ?? 0) != 1 || ($row['ShowInPocket'] ?? 0) != 1) {
            throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
        }

        return $this->map($row);
    }

    private function assertAssortment(CustomerRecord $customer): void
    {
        if ($customer->useProdList) {
            throw new ErpException(
                'ASSORTMENT_UNRESOLVED',
                'ამ მომხმარებლის ასორტიმენტის წყარო FMG-ში დაუდგენელია. კატალოგი არ გაიხსნა.',
                422,
            );
        }

        if (! $customer->orgShowPocket) {
            throw new ErpException(
                'ASSORTMENT_HIDDEN',
                'ეს მომხმარებელი მობილურ კატალოგში არ ჩანს.',
                422,
            );
        }
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function map(array $row): ItemRecord
    {
        $raw = $row['UnitPrice'] ?? null;
        $unitPrice = null;
        $priceState = 'unavailable';
        $priceError = null;

        if ($raw !== null && $raw !== '') {
            $unitPrice = Decimal::normalize((string) $raw, 4);
            $priceState = 'list';
        } else {
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
