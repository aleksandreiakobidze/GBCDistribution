<?php

namespace App\Erp\Fake;

use App\Erp\Contracts\CustomerRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\PageResult;
use App\Erp\Dto\VisitSchedule;
use App\Erp\Exceptions\ErpException;

final class FakeCustomerRepository implements CustomerRepository
{
    public function listForPreseller(int $idGvari, ?string $search, ?string $cursor, int $limit): PageResult
    {
        $this->assertPreseller($idGvari);

        $ids = $this->assignedIds($idGvari);
        $rows = array_values(array_filter(
            FakeErpState::$customers,
            function (array $c) use ($ids, $search) {
                if (! in_array((string) $c['IdOrg'], $ids, true)) {
                    return false;
                }
                if (($c['Active'] ?? false) !== true) {
                    return false;
                }
                if ($search) {
                    $hay = mb_strtolower(($c['Org'] ?? '').' '.($c['City'] ?? '').' '.($c['OrgCode'] ?? ''));
                    if (! str_contains($hay, mb_strtolower($search))) {
                        return false;
                    }
                }

                return true;
            }
        ));

        usort($rows, fn ($a, $b) => (int) $a['IdOrg'] <=> (int) $b['IdOrg']);

        if ($cursor !== null && $cursor !== '') {
            $rows = array_values(array_filter($rows, fn ($r) => (int) $r['IdOrg'] > (int) $cursor));
        }

        $slice = array_slice($rows, 0, $limit);
        $hasMore = count($rows) > $limit;
        $next = $hasMore ? (string) $slice[array_key_last($slice)]['IdOrg'] : null;

        return new PageResult(
            array_map(fn ($r) => $this->map($r, $idGvari), $slice),
            $hasMore,
            $next,
        );
    }

    public function getAuthorized(int $idGvari, string $customerId): CustomerRecord
    {
        $this->assertPreseller($idGvari);

        if (! $this->isAssigned($idGvari, $customerId)) {
            throw new ErpException('CUSTOMER_NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა.', 404);
        }

        foreach (FakeErpState::$customers as $row) {
            if ((string) $row['IdOrg'] === $customerId) {
                if (($row['Active'] ?? false) !== true) {
                    throw new ErpException('CUSTOMER_INACTIVE', 'მომხმარებელი არააქტიურია.', 422);
                }

                return $this->map($row, $idGvari);
            }
        }

        throw new ErpException('CUSTOMER_NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა.', 404);
    }

    public function isAssigned(int $idGvari, string $customerId): bool
    {
        return in_array($customerId, $this->assignedIds($idGvari), true);
    }

    public function isPresellerActive(int $idGvari): bool
    {
        foreach (FakeErpState::$presellers as $p) {
            if ((int) $p['IdGvari'] === $idGvari) {
                return (bool) ($p['GvariActive'] ?? false) && (bool) ($p['IsPreseller'] ?? false);
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    private function assignedIds(int $idGvari): array
    {
        $ids = [];
        foreach (FakeErpState::$assignments as $row) {
            if ((int) $row['IdGvari'] === $idGvari) {
                $ids[] = (string) $row['IdOrg'];
            }
        }

        return array_values(array_unique($ids));
    }

    private function assertPreseller(int $idGvari): void
    {
        if (! $this->isPresellerActive($idGvari)) {
            throw new ErpException('PRESELLER_INACTIVE', 'პრისელერის ანგარიში არააქტიურია.', 403);
        }
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function map(array $row, int $idGvari): CustomerRecord
    {
        $s = $row['schedule'] ?? [];

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
            useProdList: (bool) ($row['UseProdList'] ?? false),
            orgShowPocket: (bool) ($row['OrgShowPocket'] ?? true),
            active: (bool) ($row['Active'] ?? false),
            schedule: new VisitSchedule(
                (bool) ($s['MON'] ?? false),
                (bool) ($s['TUE'] ?? false),
                (bool) ($s['WED'] ?? false),
                (bool) ($s['THU'] ?? false),
                (bool) ($s['FRI'] ?? false),
                (bool) ($s['SAT'] ?? false),
                (bool) ($s['SUN'] ?? false),
                (int) ($s['MONNum'] ?? 0),
                (int) ($s['TUENum'] ?? 0),
                (int) ($s['WEDNum'] ?? 0),
                (int) ($s['THUNum'] ?? 0),
                (int) ($s['FRINum'] ?? 0),
                (int) ($s['SATNum'] ?? 0),
                (int) ($s['SUNNum'] ?? 0),
            ),
        );
    }
}
