<?php

namespace App\Erp\Fmg;

use App\Erp\Contracts\CustomerRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\KegPocketRecord;
use App\Erp\Dto\PageResult;
use App\Erp\Dto\VisitSchedule;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\Decimal;
use App\Erp\Support\OrderLimit;
use App\Erp\Support\VisitDay;
use Carbon\Carbon;

final class FmgCustomerRepository implements CustomerRepository
{
    public function __construct(private readonly FmgConnection $fmg)
    {
    }

    public function listForPreseller(int $idGvari, ?string $search, ?string $cursor, int $limit, string $day = 'all'): PageResult
    {
        $this->assertPreseller($idGvari);

        $day = VisitDay::normalize($day);
        $limitPlus = max(1, min($limit + 1, 501));
        $text = $this->orgTextColumns();
        $scheduleCols = $this->scheduleColumns();
        $flag = VisitDay::fmgFlag();
        if (! in_array($flag, VisitDay::FLAGS, true)) {
            throw new ErpException('INVALID_DAY', 'ვიზიტის დღე არასწორია.', 422);
        }
        $num = $flag.'Num';
        $from = <<<SQL
FROM dbo.OrgView AS o
CROSS APPLY (
    SELECT TOP 1
        og.MON, og.TUE, og.WED, og.THU, og.FRI, og.SAT, og.SUN,
        og.MONNum, og.TUENum, og.WEDNum, og.THUNum, og.FRINum, og.SATNum, og.SUNNum
    FROM dbo.OrgGvariView AS og
    WHERE og.IdOrg = o.IdOrg
      AND og.IdGvari = :idGvari
) AS og
OUTER APPLY (
    SELECT TOP 1 ot.CanRealHalfComp
    FROM dbo.OrgTView AS ot
    WHERE ot.IdOrgT = o.IdOrgT
) AS ot
WHERE o.Active = 1
  AND o.OrgShowPocket = 1
SQL;

        $bindings = [
            'idGvari' => $idGvari,
        ];
        $searchSql = '';

        if ($search !== null && trim($search) !== '') {
            $term = trim($search);
            $searchSql = ' AND ('
                .FmgNvarchar::likeContains('o.Org', $term)
                .' OR '.FmgNvarchar::likeContains('o.OrgCode', $term)
                .' OR '.FmgNvarchar::likeContains('o.City', $term)
                .' OR '.FmgNvarchar::likeContains('o.Address', $term)
                .' OR CAST(o.IdOrg AS VARCHAR(12)) LIKE :searchId)';
            $bindings['searchId'] = '%'.$term.'%';
        }

        $todaySql = " AND og.{$flag} = 1";
        if ($day === 'today') {
            $cursor = null;
        }

        $pageSql = "SELECT TOP {$limitPlus}
    o.IdOrg, {$text},
    o.FG, o.IdQseli, o.IdOrgT, o.IdReg, o.IdOrgCategory, o.IdOrgCompanyCategory,
    o.Lat, o.Lon, o.UseProdList, o.OrgShowPocket, o.Active,
    ot.CanRealHalfComp,
    {$scheduleCols}
{$from}{$searchSql}";
        $pageBindings = $bindings;

        if ($day === 'today') {
            $pageSql .= $todaySql;
        }

        if ($cursor) {
            $pageSql .= ' AND o.IdOrg > :cursor';
            $pageBindings['cursor'] = (int) $cursor;
        }

        if ($day === 'today') {
            $pageSql .= " ORDER BY CASE WHEN og.{$num} > 0 THEN 0 ELSE 1 END, og.{$num}, o.IdOrg";
        } else {
            $pageSql .= ' ORDER BY o.IdOrg';
        }

        try {
            $allTotal = (int) ($this->fmg->connection()->select(
                "SELECT COUNT(*) AS c {$from}{$searchSql}",
                $bindings,
            )[0]->c ?? 0);
            $todayTotal = (int) ($this->fmg->connection()->select(
                "SELECT COUNT(*) AS c {$from}{$searchSql}{$todaySql}",
                $bindings,
            )[0]->c ?? 0);
            $rows = $this->fmg->connection()->select($pageSql, $pageBindings);
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        $hasMore = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);
        $items = [];
        foreach ($rows as $row) {
            $items[] = $this->map((array) $row);
        }
        $next = $hasMore && $items !== [] && $day !== 'today'
            ? $items[array_key_last($items)]->customerId
            : null;

        return new PageResult($items, $hasMore, $next, $todayTotal, $allTotal);
    }

    public function getAuthorized(int $idGvari, string $customerId): CustomerRecord
    {
        $this->assertPreseller($idGvari);

        $text = $this->orgTextColumns();
        $scheduleCols = $this->scheduleColumns();
        $sql = <<<SQL
SELECT
    o.IdOrg, {$text},
    o.FG, o.IdQseli, o.IdOrgT, o.IdReg, o.IdOrgCategory, o.IdOrgCompanyCategory,
    o.Lat, o.Lon, o.UseProdList, o.OrgShowPocket, o.Active,
    o.PaymentDay, o.ValiLimit, o.[Limit],
    ot.CanRealHalfComp,
    svb.MinReal, svb.MaxReal,
    {$scheduleCols}
FROM dbo.OrgView AS o
CROSS APPLY (
    SELECT TOP 1
        og.MON, og.TUE, og.WED, og.THU, og.FRI, og.SAT, og.SUN,
        og.MONNum, og.TUENum, og.WEDNum, og.THUNum, og.FRINum, og.SATNum, og.SUNNum
    FROM dbo.OrgGvariView AS og
    WHERE og.IdOrg = o.IdOrg
      AND og.IdGvari = :idGvari
) AS og
OUTER APPLY (
    SELECT TOP 1 ot.CanRealHalfComp
    FROM dbo.OrgTView AS ot
    WHERE ot.IdOrgT = o.IdOrgT
) AS ot
OUTER APPLY (
    SELECT TOP 1 svb.MinReal, svb.MaxReal
    FROM dbo.SagadValiBlockView AS svb
    WHERE svb.Sagad = o.Sagad
) AS svb
WHERE o.IdOrg = :idOrg
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

        if (! $this->isActive($row['OrgShowPocket'] ?? null)) {
            throw new ErpException('CUSTOMER_NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა.', 404);
        }

        $idOrg = (int) $customerId;
        $balance = $this->balanceFor($idOrg);
        $overdue = $this->overdueBalanceFor(
            $idOrg,
            (int) ($row['PaymentDay'] ?? 0),
            $row['ValiLimit'] ?? null,
            $balance,
        );

        return $this->map($row, $this->kegsFor($idOrg), $balance, $overdue);
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

    private function orgTextColumns(): string
    {
        return implode(', ', [
            FmgNvarchar::col('o.Org', 'Org'),
            FmgNvarchar::col('o.OrgCode', 'OrgCode'),
            FmgNvarchar::col('o.Address', 'Address'),
            FmgNvarchar::col('o.Phone', 'Phone'),
            FmgNvarchar::col('o.City', 'City'),
            FmgNvarchar::col('o.Sagad', 'Sagad'),
            FmgNvarchar::col('o.OrgT', 'OrgT'),
            FmgNvarchar::col('o.Qseli', 'Qseli'),
            FmgNvarchar::col('o.OrgCategory', 'OrgCategory'),
        ]);
    }

    private function scheduleColumns(): string
    {
        return 'og.MON, og.TUE, og.WED, og.THU, og.FRI, og.SAT, og.SUN, og.MONNum, og.TUENum, og.WEDNum, og.THUNum, og.FRINum, og.SATNum, og.SUNNum';
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  list<KegPocketRecord>  $kegs
     */
    private function map(array $row, array $kegs = [], ?string $balance = null, ?string $overdueBalance = null): CustomerRecord
    {
        return new CustomerRecord(
            customerId: (string) $row['IdOrg'],
            name: FmgNvarchar::decode($row['Org'] ?? ''),
            orgCode: (string) $row['IdOrg'],
            address: FmgNvarchar::decodeNullable($row['Address'] ?? null),
            phone: FmgNvarchar::decodeNullable($row['Phone'] ?? null),
            city: FmgNvarchar::decodeNullable($row['City'] ?? null),
            priceGroup: (int) $row['FG'],
            sagad: FmgNvarchar::decodeNullable($row['Sagad'] ?? null),
            idQseli: (int) ($row['IdQseli'] ?? 0),
            qseli: FmgNvarchar::decodeNullable($row['Qseli'] ?? null),
            idOrgT: (int) ($row['IdOrgT'] ?? 0),
            orgT: FmgNvarchar::decodeNullable($row['OrgT'] ?? null),
            idReg: (int) ($row['IdReg'] ?? 0),
            idOrgCategory: (int) ($row['IdOrgCategory'] ?? 0),
            orgCategory: FmgNvarchar::decodeNullable($row['OrgCategory'] ?? null),
            idOrgCompanyCategory: (int) ($row['IdOrgCompanyCategory'] ?? 0),
            latitude: isset($row['Lat']) ? (string) $row['Lat'] : null,
            longitude: isset($row['Lon']) ? (string) $row['Lon'] : null,
            useProdList: $this->isActive($row['UseProdList'] ?? false),
            orgShowPocket: $this->isActive($row['OrgShowPocket'] ?? true),
            active: $this->isActive($row['Active'] ?? false),
            schedule: $this->scheduleFromRow($row),
            kegs: $kegs,
            balance: $balance,
            canRealHalfComp: $this->isActive($row['CanRealHalfComp'] ?? false),
            minOrderTotal: OrderLimit::normalize($row['MinReal'] ?? null),
            maxOrderTotal: OrderLimit::normalize($row['MaxReal'] ?? null),
            overdueBalance: $overdueBalance,
            valiLimit: $this->moneyOrNull($row['ValiLimit'] ?? null),
            paymentDay: (int) ($row['PaymentDay'] ?? 0),
            monthLimit: array_key_exists('Limit', $row) && $row['Limit'] !== null && $row['Limit'] !== ''
                ? (int) $row['Limit']
                : null,
        );
    }

    private function moneyOrNull(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Decimal::normalize((string) $value, 4);
        } catch (\InvalidArgumentException) {
            return null;
        }
    }

    /**
     * @return list<KegPocketRecord>
     */
    private function kegsFor(int $idOrg): array
    {
        $idProd = FmgNvarchar::col('k.idprod', 'IdProd');
        $prod = FmgNvarchar::col('k.prod', 'Prod');
        $sql = <<<SQL
SELECT {$idProd}, {$prod}, k.raod AS Raod
FROM dbo.QuantityOfKegPocket AS k
WHERE k.idorg = :idOrg
ORDER BY k.idprod
SQL;

        try {
            $rows = $this->fmg->connection()->select($sql, ['idOrg' => $idOrg]);
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        $items = [];
        foreach ($rows as $row) {
            $row = (array) $row;
            $itemId = FmgNvarchar::decode($row['IdProd'] ?? '');
            if ($itemId === '') {
                continue;
            }
            $quantity = $row['Raod'] ?? null;
            if ($quantity === null || $quantity === '') {
                continue;
            }
            try {
                $quantity = Decimal::normalize((string) $quantity, 3);
            } catch (\InvalidArgumentException) {
                continue;
            }
            $items[] = new KegPocketRecord(
                itemId: $itemId,
                name: FmgNvarchar::decode($row['Prod'] ?? '') ?: $itemId,
                quantity: $quantity,
            );
        }

        return $items;
    }

    private function balanceFor(int $idOrg): ?string
    {
        try {
            $rows = $this->fmg->connection()->select(
                'SELECT SUM(a.tanxa) AS Tanxa FROM dbo.AmountOfCustomerPocket AS a WHERE a.idorg = :idOrg',
                ['idOrg' => $idOrg],
            );
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        $tanxa = ((array) ($rows[0] ?? []))['Tanxa'] ?? null;
        if ($tanxa === null || $tanxa === '') {
            return null;
        }

        try {
            return Decimal::normalize((string) $tanxa, 4);
        } catch (\InvalidArgumentException) {
            return null;
        }
    }

    /**
     * AmountOfCustomerPocket has no date column, so debt as of cutoff is rebuilt from
     * today's pocket minus sales after cutoff plus returns/payments after cutoff.
     * overdue = debtAsOf - returns - payments - ValiLimit.
     */
    private function overdueBalanceFor(int $idOrg, int $paymentDay, mixed $valiLimit, ?string $balance): ?string
    {
        $today = Carbon::now('Asia/Tbilisi')->startOfDay();
        if ($today->day > $paymentDay) {
            $cutoff = $today->copy()->subMonthNoOverflow()->endOfMonth()->startOfDay();
        } else {
            $cutoff = $today->copy()->subMonthsNoOverflow(2)->endOfMonth()->startOfDay();
        }

        $balanceNum = $balance === null || $balance === '' ? 0.0 : (float) $balance;
        $sales = $this->sumTanxaAfter('dbo.PowerBiReal', $idOrg, $cutoff, $today);
        $returns = $this->sumTanxaAfter('dbo.PowerBiDabr', $idOrg, $cutoff, $today);
        $payments = $this->sumTanxaAfter('dbo.PowerBiSal', $idOrg, $cutoff, $today);
        $limit = 0.0;
        if ($valiLimit !== null && $valiLimit !== '') {
            try {
                $limit = (float) Decimal::normalize((string) $valiLimit, 4);
            } catch (\InvalidArgumentException) {
                $limit = 0.0;
            }
        }

        $debtAsOf = $balanceNum - $sales + $returns + $payments;
        $overdue = $debtAsOf - $returns - $payments - $limit;
        if ($overdue <= 0) {
            return null;
        }

        try {
            return Decimal::normalize((string) $overdue, 4);
        } catch (\InvalidArgumentException) {
            return null;
        }
    }

    private function sumTanxaAfter(string $table, int $idOrg, Carbon $cutoff, Carbon $today): float
    {
        $from = $cutoff->copy()->addDay()->startOfDay()->format('Y-m-d H:i:s');
        $toExclusive = $today->copy()->addDay()->startOfDay()->format('Y-m-d H:i:s');

        try {
            $rows = $this->fmg->connection()->select(
                'SELECT SUM(CAST(t.Tanxa AS decimal(18, 4))) AS Tanxa '
                .'FROM '.$table.' AS t '
                .'WHERE t.IdOrg = :idOrg '
                .'AND t.Data >= :fromData AND t.Data < :toData',
                [
                    'idOrg' => $idOrg,
                    'fromData' => $from,
                    'toData' => $toExclusive,
                ],
            );
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        $tanxa = ((array) ($rows[0] ?? []))['Tanxa'] ?? null;
        if ($tanxa === null || $tanxa === '') {
            return 0.0;
        }

        return (float) $tanxa;
    }

    /**
     * @param  array<string, mixed>  $s
     */
    private function scheduleFromRow(array $s): VisitSchedule
    {
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
