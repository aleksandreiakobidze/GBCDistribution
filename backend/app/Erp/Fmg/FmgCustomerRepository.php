<?php

namespace App\Erp\Fmg;

use App\Erp\Contracts\CustomerRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\PageResult;
use App\Erp\Dto\VisitSchedule;
use App\Erp\Exceptions\ErpException;

final class FmgCustomerRepository implements CustomerRepository
{
    public function __construct(private readonly FmgConnection $fmg)
    {
    }

    public function listForPreseller(int $idGvari, ?string $search, ?string $cursor, int $limit): PageResult
    {
        $this->assertPreseller($idGvari);

        $limitPlus = max(1, min($limit + 1, 501));
        $sql = <<<SQL
SELECT TOP {$limitPlus}
    o.IdOrg, o.Org, o.OrgCode, o.Address, o.Phone, o.City,
    o.FG, o.Sagad, o.IdQseli, o.IdOrgT, o.IdReg, o.IdOrgCategory,
    o.Lat, o.Lon, o.UseProdList, o.OrgShowPocket, o.Active
FROM dbo.OrgView AS o
WHERE EXISTS (
    SELECT 1
    FROM dbo.OrgGvariView AS og
    WHERE og.IdOrg = o.IdOrg
      AND og.IdGvari = :idGvari
)
  AND o.Active = 1
SQL;

        $bindings = [
            'idGvari' => $idGvari,
        ];

        if ($cursor) {
            $sql .= ' AND o.IdOrg > :cursor';
            $bindings['cursor'] = (int) $cursor;
        }

        if ($search) {
            $sql .= ' AND (o.Org LIKE :search OR o.OrgCode LIKE :search2 OR o.City LIKE :search3)';
            $like = '%'.$search.'%';
            $bindings['search'] = $like;
            $bindings['search2'] = $like;
            $bindings['search3'] = $like;
        }

        $sql .= ' ORDER BY o.IdOrg';

        try {
            $rows = $this->fmg->connection()->select($sql, $bindings);
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        $hasMore = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);
        $items = [];
        foreach ($rows as $row) {
            $items[] = $this->map((array) $row, $idGvari);
        }
        $next = $hasMore && $items !== [] ? $items[array_key_last($items)]->customerId : null;

        return new PageResult($items, $hasMore, $next);
    }

    public function getAuthorized(int $idGvari, string $customerId): CustomerRecord
    {
        $this->assertPreseller($idGvari);

        $sql = <<<'SQL'
SELECT
    o.IdOrg, o.Org, o.OrgCode, o.Address, o.Phone, o.City,
    o.FG, o.Sagad, o.IdQseli, o.IdOrgT, o.IdReg, o.IdOrgCategory,
    o.Lat, o.Lon, o.UseProdList, o.OrgShowPocket, o.Active
FROM dbo.OrgView AS o
WHERE o.IdOrg = :idOrg
  AND EXISTS (
    SELECT 1
    FROM dbo.OrgGvariView AS og
    WHERE og.IdOrg = o.IdOrg
      AND og.IdGvari = :idGvari
)
SQL;

        try {
            $rows = $this->fmg->connection()->select($sql, [
                'idOrg' => (int) $customerId,
                'idGvari' => $idGvari,
            ]);
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        if ($rows === []) {
            throw new ErpException('CUSTOMER_NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა.', 404);
        }

        $row = (array) $rows[0];
        if (! $this->isActive($row['Active'] ?? null)) {
            throw new ErpException('CUSTOMER_INACTIVE', 'მომხმარებელი არააქტიურია.', 422);
        }

        return $this->map($row, $idGvari);
    }

    public function isAssigned(int $idGvari, string $customerId): bool
    {
        try {
            $rows = $this->fmg->connection()->select(
                'SELECT TOP 1 1 AS ok FROM dbo.OrgGvariView WHERE IdOrg = :idOrg AND IdGvari = :idGvari',
                ['idOrg' => (int) $customerId, 'idGvari' => $idGvari],
            );
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        return $rows !== [];
    }

    public function isPresellerActive(int $idGvari): bool
    {
        try {
            $rows = $this->fmg->connection()->select(
                'SELECT TOP 1 GvariActive, IsPreseller FROM dbo.GvariView WHERE IdGvari = :id',
                ['id' => $idGvari],
            );
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        if ($rows === []) {
            return false;
        }

        $row = (array) $rows[0];

        return $this->isActive($row['GvariActive'] ?? null) && $this->isActive($row['IsPreseller'] ?? null);
    }

    private function assertPreseller(int $idGvari): void
    {
        if (! $this->isPresellerActive($idGvari)) {
            throw new ErpException('PRESELLER_INACTIVE', 'პრისელერის ანგარიში არააქტიურია.', 403);
        }
    }

    private function isActive(mixed $value): bool
    {
        return $value === true || $value === 1 || $value === '1';
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function map(array $row, int $idGvari): CustomerRecord
    {
        return new CustomerRecord(
            customerId: (string) $row['IdOrg'],
            name: (string) ($row['Org'] ?? ''),
            orgCode: $row['OrgCode'] ?? null,
            address: $row['Address'] ?? null,
            phone: $row['Phone'] ?? null,
            city: $row['City'] ?? null,
            priceGroup: (int) $row['FG'],
            sagad: $row['Sagad'] ?? null,
            idQseli: (int) ($row['IdQseli'] ?? 0),
            idOrgT: (int) ($row['IdOrgT'] ?? 0),
            idReg: (int) ($row['IdReg'] ?? 0),
            idOrgCategory: (int) ($row['IdOrgCategory'] ?? 0),
            latitude: isset($row['Lat']) ? (string) $row['Lat'] : null,
            longitude: isset($row['Lon']) ? (string) $row['Lon'] : null,
            useProdList: $this->isActive($row['UseProdList'] ?? false),
            orgShowPocket: $this->isActive($row['OrgShowPocket'] ?? true),
            active: $this->isActive($row['Active'] ?? false),
            schedule: $this->schedule($idGvari, (int) $row['IdOrg']),
        );
    }

    private function schedule(int $idGvari, int $idOrg): ?VisitSchedule
    {
        try {
            $rows = $this->fmg->connection()->select(
                'SELECT TOP 1 MON, TUE, WED, THU, FRI, SAT, SUN, MONNum, TUENum, WEDNum, THUNum, FRINum, SATNum, SUNNum
                 FROM dbo.OrgGvariView WHERE IdOrg = :idOrg AND IdGvari = :idGvari',
                ['idOrg' => $idOrg, 'idGvari' => $idGvari],
            );
        } catch (\Throwable) {
            return null;
        }

        if ($rows === []) {
            return null;
        }

        $s = (array) $rows[0];

        return new VisitSchedule(
            $this->isActive($s['MON'] ?? false),
            $this->isActive($s['TUE'] ?? false),
            $this->isActive($s['WED'] ?? false),
            $this->isActive($s['THU'] ?? false),
            $this->isActive($s['FRI'] ?? false),
            $this->isActive($s['SAT'] ?? false),
            $this->isActive($s['SUN'] ?? false),
            (int) ($s['MONNum'] ?? 0),
            (int) ($s['TUENum'] ?? 0),
            (int) ($s['WEDNum'] ?? 0),
            (int) ($s['THUNum'] ?? 0),
            (int) ($s['FRINum'] ?? 0),
            (int) ($s['SATNum'] ?? 0),
            (int) ($s['SUNNum'] ?? 0),
        );
    }
}
