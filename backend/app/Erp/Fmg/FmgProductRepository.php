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

    public function listForCustomer(int $idGvari, CustomerRecord $customer, ?string $search, ?string $cursor, int $limit, array $filters = []): PageResult
    {
        $this->assertAssortment($customer);

        if (! $this->mapping->isValid($customer->priceGroup)) {
            throw new ErpException('PRICE_GROUP_UNMAPPED', 'ამ მომხმარებლის ფასების ჯგუფი არ არის დაშვებული.', 422);
        }

        $priceExpr = $this->mapping->sqlCaseExpression('p', ':fg');
        $limitPlus = max(1, min($limit + 1, 501));
        $text = $this->textColumns();
        $sql = <<<SQL
SELECT TOP {$limitPlus}
    {$text},
    p.Active, p.ShowInPocket, p.CompRaod, p.CanRealHalfComp,
    {$priceExpr} AS UnitPrice
FROM dbo.ProdView AS p
WHERE p.Active = 1
  AND p.ShowInPocket = 1
SQL;

        $bindings = [
            'fg' => $customer->priceGroup,
        ];
        $sql = $this->applyFilters(
            $sql,
            $bindings,
            $search,
            $cursor,
            $filters['prodT'] ?? null,
            $filters['prodG'] ?? null,
            $filters['category'] ?? null,
            $filters['prodS'] ?? null,
        );
        $sql .= ' ORDER BY p.ProdT, p.Prod, p.IdProd';

        $rows = $this->select($sql, $bindings);
        $hasMore = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);
        $items = array_map(fn ($row) => $this->map((array) $row, priced: true), $rows);
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
        $text = $this->textColumns();
        $sql = <<<SQL
SELECT
    {$text},
    p.Active, p.ShowInPocket, p.CompRaod, p.CanRealHalfComp,
    {$priceExpr} AS UnitPrice
FROM dbo.ProdView AS p
WHERE p.IdProd = :idProd
SQL;

        $rows = $this->select($sql, [
            'fg' => $customer->priceGroup,
            'idProd' => $itemId,
        ]);

        if ($rows === []) {
            throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
        }

        $row = (array) $rows[0];
        if (! $this->isPocketRow($row)) {
            throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
        }

        return $this->map($row, priced: true);
    }

    public function listCatalog(array $filters, int $limit): PageResult
    {
        $limitPlus = max(1, min($limit + 1, 501));
        $text = $this->textColumns();
        $sql = <<<SQL
SELECT TOP {$limitPlus}
    {$text},
    p.Active, p.ShowInPocket, p.CompRaod, p.CanRealHalfComp
FROM dbo.ProdView AS p
WHERE p.Active = 1
  AND p.ShowInPocket = 1
SQL;

        $bindings = [];
        $sql = $this->applyFilters(
            $sql,
            $bindings,
            $filters['search'] ?? null,
            $filters['cursor'] ?? null,
            $filters['prodT'] ?? null,
            $filters['prodG'] ?? null,
            $filters['category'] ?? null,
            $filters['prodS'] ?? null,
        );
        $sql .= ' ORDER BY p.ProdT, p.Prod, p.IdProd';

        $rows = $this->select($sql, $bindings);
        $hasMore = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);
        $items = array_map(fn ($row) => $this->map((array) $row, priced: false), $rows);
        $next = $hasMore && $items !== [] ? $items[array_key_last($items)]->itemId : null;

        return new PageResult($items, $hasMore, $next);
    }

    public function getCatalogItem(string $itemId): ItemRecord
    {
        $text = $this->textColumns();
        $sql = <<<SQL
SELECT
    {$text},
    p.Active, p.ShowInPocket, p.CompRaod, p.CanRealHalfComp
FROM dbo.ProdView AS p
WHERE p.IdProd = :idProd
SQL;

        $rows = $this->select($sql, ['idProd' => $itemId]);
        if ($rows === []) {
            throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
        }

        $row = (array) $rows[0];
        if (! $this->isPocketRow($row)) {
            throw new ErpException('ITEM_NOT_FOUND', 'პროდუქტი ვერ მოიძებნა.', 404);
        }

        return $this->map($row, priced: false);
    }

    public function listCatalogGroups(): array
    {
        $sql = 'SELECT '
            .FmgNvarchar::col('p.ProdT', 'ProdT')
            .', COUNT(*) AS itemCount
FROM dbo.ProdView AS p
WHERE p.Active = 1
  AND p.ShowInPocket = 1
GROUP BY p.ProdT
ORDER BY p.ProdT';

        $rows = $this->select($sql, []);
        $out = [];
        foreach ($rows as $row) {
            $r = (array) $row;
            $name = FmgNvarchar::decode($r['ProdT'] ?? '');
            $out[] = [
                'name' => $name,
                'count' => (int) ($r['itemCount'] ?? $r['itemcount'] ?? 0),
            ];
        }

        return $out;
    }

    public function listCatalogTaxonomy(): array
    {
        $sql = 'SELECT '
            .FmgNvarchar::col('p.ProdS', 'ProdS').', '
            .FmgNvarchar::col('p.ProdT', 'ProdT').', COUNT(*) AS itemCount
FROM dbo.ProdView AS p
WHERE p.Active = 1
  AND p.ShowInPocket = 1
GROUP BY p.ProdS, p.ProdT
ORDER BY p.ProdS, p.ProdT';

        $rows = $this->select($sql, []);
        $byProdS = [];
        foreach ($rows as $row) {
            $r = (array) $row;
            $prodS = FmgNvarchar::decode($r['ProdS'] ?? '');
            $prodT = FmgNvarchar::decode($r['ProdT'] ?? '');
            $count = (int) ($r['itemCount'] ?? $r['itemcount'] ?? 0);
            if (! isset($byProdS[$prodS])) {
                $byProdS[$prodS] = ['name' => $prodS, 'count' => 0, 'types' => []];
            }
            $byProdS[$prodS]['count'] += $count;
            $byProdS[$prodS]['types'][] = ['name' => $prodT, 'count' => $count];
        }

        return array_values($byProdS);
    }

    private function textColumns(): string
    {
        return implode(', ', [
            FmgNvarchar::col('p.IdProd', 'IdProd'),
            FmgNvarchar::col('p.Prod', 'Prod'),
            FmgNvarchar::col('p.Ert', 'Ert'),
            FmgNvarchar::col('p.UnitName', 'UnitName'),
            FmgNvarchar::col('p.ProdCode', 'ProdCode'),
            FmgNvarchar::col('p.ProdCategory', 'ProdCategory'),
            FmgNvarchar::col('p.ProdS', 'ProdS'),
            FmgNvarchar::col('p.ProdT', 'ProdT'),
            FmgNvarchar::col('p.ProdG', 'ProdG'),
        ]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     */
    private function applyFilters(
        string $sql,
        array &$bindings,
        ?string $search,
        ?string $cursor,
        ?string $prodT,
        ?string $prodG,
        ?string $category,
        ?string $prodS = null,
    ): string {
        if ($cursor) {
            $sql .= ' AND p.IdProd > :cursor';
            $bindings['cursor'] = $cursor;
        }

        if ($search) {
            $sql .= ' AND ('
                .FmgNvarchar::likeContains('p.Prod', $search)
                .' OR '.FmgNvarchar::likeContains('p.ProdCode', $search)
                .' OR p.IdProd LIKE :searchId)';
            $bindings['searchId'] = '%'.$search.'%';
        }

        $sql .= $this->nvarcharEquals('p.ProdS', 'prodSHex', $prodS, $bindings);
        $sql .= $this->nvarcharEquals('p.ProdT', 'prodTHex', $prodT, $bindings);
        $sql .= $this->nvarcharEquals('p.ProdG', 'prodGHex', $prodG, $bindings);
        $sql .= $this->nvarcharEquals('p.ProdCategory', 'categoryHex', $category, $bindings);

        return $sql;
    }

    /**
     * @param  array<string, mixed>  $bindings
     */
    private function nvarcharEquals(string $expression, string $binding, ?string $utf8, array &$bindings): string
    {
        if ($utf8 === null) {
            return '';
        }

        if ($utf8 === '') {
            return ' AND ('.$expression.' IS NULL OR DATALENGTH('.$expression.') = 0)';
        }

        $bindings[$binding] = FmgNvarchar::encodeHex($utf8);

        return ' AND CONVERT(VARCHAR(MAX), CAST('.$expression.' AS VARBINARY(MAX)), 1) = :'.$binding;
    }

    /**
     * @return list<object>
     */
    private function select(string $sql, array $bindings): array
    {
        try {
            return $this->fmg->connection()->select($sql, $bindings);
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function isPocketRow(array $row): bool
    {
        return ($row['Active'] ?? 0) == 1 && ($row['ShowInPocket'] ?? 0) == 1;
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
    private function map(array $row, bool $priced): ItemRecord
    {
        $unitPrice = null;
        $priceState = 'omitted';
        $priceError = null;

        if ($priced) {
            $raw = $row['UnitPrice'] ?? null;
            $priceState = 'unavailable';
            if ($raw !== null && $raw !== '') {
                $unitPrice = Decimal::normalize((string) $raw, 4);
                $priceState = 'list';
            } else {
                $priceError = 'PRICE_UNAVAILABLE';
            }
        }

        return new ItemRecord(
            itemId: FmgNvarchar::decode($row['IdProd'] ?? ''),
            name: FmgNvarchar::decode($row['Prod'] ?? ''),
            unit: FmgNvarchar::decode($row['Ert'] ?? ''),
            unitName: FmgNvarchar::decodeNullable($row['UnitName'] ?? null),
            prodCode: FmgNvarchar::decodeNullable($row['ProdCode'] ?? null),
            category: FmgNvarchar::decodeNullable($row['ProdCategory'] ?? null),
            prodS: FmgNvarchar::decodeNullable($row['ProdS'] ?? null),
            type: FmgNvarchar::decodeNullable($row['ProdT'] ?? null),
            group: FmgNvarchar::decodeNullable($row['ProdG'] ?? null),
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
