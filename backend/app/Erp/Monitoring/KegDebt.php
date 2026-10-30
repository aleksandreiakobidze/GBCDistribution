<?php

namespace App\Erp\Monitoring;

use App\Erp\Fmg\FmgConnection;
use App\Erp\Fmg\FmgNvarchar;
use App\Erp\Support\GeoPoint;

final class KegDebt
{
    public function __construct(private readonly FmgConnection $fmg)
    {
    }

    /**
     * @return list<array{idOrg: string, name: string, debt: float}>
     */
    public function forPreseller(int $idGvari): array
    {
        $sql = 'SELECT '
            .FmgNvarchar::col('Idorg', 'idorg_hex').', '
            .FmgNvarchar::col('MAX(Org)', 'org_hex').', '
            .'SUM(CASE WHEN Idprod IS NULL OR LTRIM(RTRIM(Idprod)) = N\'\' THEN CAST(tanxa AS decimal(18, 4)) ELSE 0 END) AS debt '
            .'FROM dbo.Sharepoint_Kegebi '
            .'WHERE Idgvari = ? '
            .'GROUP BY Idorg';

        $rows = $this->fmg->connection()->select($sql, [$idGvari]);
        $orgs = [];
        foreach ($rows as $row) {
            $idOrg = trim(FmgNvarchar::decode($row->idorg_hex ?? ''));
            $name = trim(FmgNvarchar::decode($row->org_hex ?? ''));
            if ($idOrg === '' && $name === '') {
                continue;
            }
            $orgs[] = [
                'idOrg' => $idOrg,
                'name' => $name !== '' ? $name : $idOrg,
                'debt' => round((float) $row->debt, 2),
            ];
        }

        usort($orgs, function (array $left, array $right): int {
            $byDebt = $right['debt'] <=> $left['debt'];

            return $byDebt !== 0 ? $byDebt : strcmp($left['name'], $right['name']);
        });

        return $orgs;
    }

    /**
     * @param  list<string>  $idOrgs
     * @return array<string, array{address: string, latitude: float|null, longitude: float|null}>
     */
    public function places(array $idOrgs): array
    {
        $ids = [];
        foreach ($idOrgs as $idOrg) {
            if (ctype_digit($idOrg) && (int) $idOrg > 0) {
                $ids[(int) $idOrg] = (int) $idOrg;
            }
        }
        if ($ids === []) {
            return [];
        }

        $places = [];
        foreach (array_chunk(array_values($ids), 400) as $chunk) {
            $sql = 'SELECT o.IdOrg, '
                .FmgNvarchar::col('o.LegalAddress', 'address_hex').', '
                .'o.Lat AS lat, o.Lon AS lon '
                .'FROM dbo.OrgView AS o WHERE o.IdOrg IN ('.implode(',', $chunk).')';
            foreach ($this->fmg->connection()->select($sql) as $row) {
                $id = (string) (int) $row->IdOrg;
                $lat = is_numeric($row->lat ?? null) ? (string) $row->lat : null;
                $lon = is_numeric($row->lon ?? null) ? (string) $row->lon : null;
                $plottable = GeoPoint::isPlottable($lat, $lon);
                $places[$id] = [
                    'address' => trim(FmgNvarchar::decode($row->address_hex ?? '')),
                    'latitude' => $plottable ? (float) $lat : null,
                    'longitude' => $plottable ? (float) $lon : null,
                ];
            }
        }

        return $places;
    }

    /**
     * @param  list<int>|null  $idGvaris
     * @return array{idOrg: string, name: string, debt: float, stock: list<array{idProd: string, name: string, qty: float}>}|null
     */
    public function card(string $idOrg, ?array $idGvaris): ?array
    {
        $idOrg = trim($idOrg);
        $hex = FmgNvarchar::encodeHex($idOrg);
        if ($idOrg === '' || ! preg_match('/^0x[0-9A-F]+$/', $hex)) {
            return null;
        }

        $sql = 'SELECT '
            .FmgNvarchar::col('Idprod', 'idprod_hex').', '
            .FmgNvarchar::col('Prod', 'prod_hex').', '
            .FmgNvarchar::col('Org', 'org_hex').', '
            .'CAST(Raod AS decimal(18, 4)) AS qty, '
            .'CAST(tanxa AS decimal(18, 4)) AS debt '
            .'FROM dbo.Sharepoint_Kegebi '
            ."WHERE CONVERT(VARCHAR(MAX), CAST(Idorg AS VARBINARY(MAX)), 1) = '".$hex."'"
            .$this->scopeSql($idGvaris);

        $rows = $this->fmg->connection()->select($sql);
        if ($rows === []) {
            return null;
        }

        $name = '';
        $debt = 0.0;
        $stock = [];
        foreach ($rows as $row) {
            $orgName = trim(FmgNvarchar::decode($row->org_hex ?? ''));
            if ($name === '' && $orgName !== '') {
                $name = $orgName;
            }
            $idProd = trim(FmgNvarchar::decode($row->idprod_hex ?? ''));
            if ($idProd === '') {
                $debt += (float) $row->debt;
                continue;
            }
            $product = trim(FmgNvarchar::decode($row->prod_hex ?? ''));
            $key = $idProd."\n".$product;
            if (! isset($stock[$key])) {
                $stock[$key] = [
                    'idProd' => $idProd,
                    'name' => $product !== '' ? $product : $idProd,
                    'qty' => 0.0,
                ];
            }
            $stock[$key]['qty'] += (float) $row->qty;
        }

        $lines = array_values($stock);
        foreach ($lines as &$line) {
            $line['qty'] = round($line['qty'], 2);
        }
        unset($line);
        usort($lines, fn (array $left, array $right): int => strcmp($left['name'], $right['name']));

        return [
            'idOrg' => $idOrg,
            'name' => $name !== '' ? $name : $idOrg,
            'debt' => round($debt, 2),
            'stock' => $lines,
        ];
    }

    /**
     * @param  list<int>|null  $idGvaris
     */
    private function scopeSql(?array $idGvaris): string
    {
        if ($idGvaris === null) {
            return '';
        }
        if ($idGvaris === []) {
            return ' AND 1 = 0';
        }

        $ids = array_map(fn ($id) => (string) (int) $id, $idGvaris);

        return ' AND Idgvari IN ('.implode(',', $ids).')';
    }
}
