<?php

namespace App\Erp\Plan;

use App\Erp\Exceptions\ErpException;
use App\Erp\Fmg\FmgConnection;
use App\Erp\Fmg\FmgNvarchar;
use DateTimeImmutable;
use Throwable;

/**
 * Net volume is SUM(TevadobaTotal) on PowerBiReal minus the same sum on PowerBiDabr.
 * Volumes are scoped to IdOrg on active OrgView (OrgDesc2) linked via OrgGvariView to the salesperson.
 */
final class PlanActuals
{
    public function __construct(private readonly FmgConnection $fmg) {}

    public function gvariName(int $idGvari): ?string
    {
        try {
            $row = $this->fmg->connection()->selectOne(
                'SELECT TOP 1 '.FmgNvarchar::col('Gvari', 'Gvari').' FROM dbo.GvariView WHERE IdGvari = ?',
                [$idGvari],
            );
        } catch (Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }
        if (! $row) {
            return null;
        }

        $name = FmgNvarchar::decodeNullable($row->Gvari ?? null);

        return $name === null || trim($name) === '' ? null : trim($name);
    }

    /**
     * @param  list<array{presale: string, supervisor?: string, channel: string, category: string, brand: string, startsOn: string, endsOn: string}>  $lines
     * @return array<string, array{real: float, return: float, presale: string, supervisor: string, channel: string, category: string, brand: string, startsOn: string, endsOn: string}>
     */
    public function forLines(array $lines): array
    {
        $windows = [];
        foreach ($lines as $line) {
            $windows[$line['startsOn'].'|'.$line['endsOn']] = [$line['startsOn'], $line['endsOn']];
        }
        if ($windows === []) {
            return [];
        }

        if (count($windows) === 1) {
            [$start, $end] = array_values($windows)[0];
            $real = $this->volumes('dbo.PowerBiReal', $start, $this->nextDay($end));
            $returns = $this->volumes('dbo.PowerBiDabr', $start, $this->nextDay($end));

            return $this->appendUnplanned($this->pack($lines, function (string $key) use ($real, $returns): array {
                return [
                    (float) ($real[$key]['volume'] ?? 0),
                    (float) ($returns[$key]['volume'] ?? 0),
                ];
            }), $lines, $real, $returns, false);
        }

        $min = min(array_column($windows, 0));
        $max = max(array_column($windows, 1));
        $realDays = $this->volumesByDay('dbo.PowerBiReal', $min, $this->nextDay($max));
        $returnDays = $this->volumesByDay('dbo.PowerBiDabr', $min, $this->nextDay($max));

        return $this->appendUnplanned($this->pack($lines, function (string $key, array $line) use ($realDays, $returnDays): array {
            return [
                $this->sumDays($realDays[$key]['days'] ?? [], $line['startsOn'], $line['endsOn']),
                $this->sumDays($returnDays[$key]['days'] ?? [], $line['startsOn'], $line['endsOn']),
            ];
        }), $lines, $realDays, $returnDays, true);
    }

    /**
     * @param  list<array{presale: string, supervisor?: string, channel: string, category: string, brand: string, startsOn: string, endsOn: string}>  $lines
     * @param  callable(string, array{presale: string, supervisor?: string, channel: string, category: string, brand: string, startsOn: string, endsOn: string}): array{0: float, 1: float}  $amounts
     * @return array<string, array{real: float, return: float, presale: string, supervisor: string, channel: string, category: string, brand: string, startsOn: string, endsOn: string}>
     */
    private function pack(array $lines, callable $amounts): array
    {
        $facts = [];
        foreach ($lines as $line) {
            $supervisor = (string) ($line['supervisor'] ?? '');
            $factKey = PlanScore::factKey(
                $line['presale'],
                $line['channel'],
                $line['category'],
                $line['brand'],
                $line['startsOn'],
                $line['endsOn'],
                $supervisor,
            );
            if (isset($facts[$factKey])) {
                continue;
            }
            $dimension = PlanScore::dimensionKey(
                $line['presale'],
                $line['channel'],
                $line['category'],
                $line['brand'],
                $supervisor,
            );
            [$real, $return] = $amounts($dimension, $line);
            $facts[$factKey] = [
                'real' => round($real, 4),
                'return' => round($return, 4),
                'presale' => PlanScore::normalize($line['presale']),
                'supervisor' => PlanScore::normalize($supervisor),
                'channel' => PlanScore::normalize($line['channel']),
                'category' => PlanScore::normalize($line['category']),
                'brand' => PlanScore::normalize($line['brand']),
                'startsOn' => $line['startsOn'],
                'endsOn' => $line['endsOn'],
            ];
        }

        return $facts;
    }

    /**
     * @param  array<string, float>  $days
     */
    private function sumDays(array $days, string $start, string $end): float
    {
        $sum = 0.0;
        foreach ($days as $day => $amount) {
            if ($day >= $start && $day <= $end) {
                $sum += $amount;
            }
        }

        return $sum;
    }

    /**
     * @param  array<string, array{real: float, return: float, presale: string, supervisor: string, channel: string, category: string, brand: string, startsOn: string, endsOn: string}>  $facts
     * @param  list<array{presale: string, supervisor?: string, category: string, brand: string, startsOn: string, endsOn: string}>  $lines
     * @param  array<string, array{presale: string, supervisor: string, channel: string, category: string, brand: string, volume?: float, days?: array<string, float>}>  $real
     * @param  array<string, array{presale: string, supervisor: string, channel: string, category: string, brand: string, volume?: float, days?: array<string, float>}>  $returns
     * @return array<string, array{real: float, return: float, presale: string, supervisor: string, channel: string, category: string, brand: string, startsOn: string, endsOn: string}>
     */
    private function appendUnplanned(array $facts, array $lines, array $real, array $returns, bool $byDay): array
    {
        $windows = [];
        foreach ($lines as $line) {
            $presale = PlanScore::normalize($line['presale']);
            $supervisor = PlanScore::normalize((string) ($line['supervisor'] ?? ''));
            $windows[$presale][$supervisor][$line['startsOn'].'|'.$line['endsOn']] = [$line['startsOn'], $line['endsOn']];
        }

        foreach (array_unique([...array_keys($real), ...array_keys($returns)]) as $dimension) {
            $sample = $real[$dimension] ?? $returns[$dimension];
            $presale = PlanScore::normalize($sample['presale']);
            $supervisor = PlanScore::normalize((string) ($sample['supervisor'] ?? ''));
            if (! isset($windows[$presale][$supervisor])) {
                continue;
            }
            foreach ($windows[$presale][$supervisor] as [$start, $end]) {
                $factKey = PlanScore::factKey(
                    $sample['presale'],
                    $sample['channel'],
                    $sample['category'],
                    $sample['brand'],
                    $start,
                    $end,
                    $supervisor,
                );
                if (isset($facts[$factKey])) {
                    continue;
                }
                $realVolume = $byDay
                    ? $this->sumDays($real[$dimension]['days'] ?? [], $start, $end)
                    : (float) ($real[$dimension]['volume'] ?? 0);
                $returnVolume = $byDay
                    ? $this->sumDays($returns[$dimension]['days'] ?? [], $start, $end)
                    : (float) ($returns[$dimension]['volume'] ?? 0);
                if (abs($realVolume) < 0.0000001 && abs($returnVolume) < 0.0000001) {
                    continue;
                }
                $facts[$factKey] = [
                    'real' => round($realVolume, 4),
                    'return' => round($returnVolume, 4),
                    'presale' => $sample['presale'],
                    'supervisor' => $supervisor,
                    'channel' => $sample['channel'],
                    'category' => $sample['category'],
                    'brand' => $sample['brand'],
                    'startsOn' => $start,
                    'endsOn' => $end,
                ];
            }
        }

        return $facts;
    }

    /**
     * @return array<string, array{volume: float, presale: string, supervisor: string, channel: string, category: string, brand: string}>
     */
    private function volumes(string $table, string $from, string $toExclusive): array
    {
        $sql = 'SELECT '
            .FmgNvarchar::col('g.Gvari', 'gvari_hex').', '
            .FmgNvarchar::col('o.OrgDesc2', 'orgdesc2_hex').', '
            .FmgNvarchar::col('r.OrgT', 'orgt_hex').', '
            .FmgNvarchar::col('r.ProdS', 'prods_hex').', '
            .FmgNvarchar::col('r.ProdT', 'prodt_hex').', '
            .'SUM(CAST(r.TevadobaTotal AS float)) AS volume
            FROM '.$table.' AS r
            INNER JOIN (
                SELECT DISTINCT og.IdOrg, og.IdGvari
                FROM dbo.OrgGvariView AS og
                WHERE og.Active = 1
            ) AS og ON og.IdOrg = r.IdOrg
            INNER JOIN dbo.OrgView AS o ON o.IdOrg = og.IdOrg AND o.Active = 1 AND o.OrgDesc2 <> \'\'
            INNER JOIN dbo.GvariView AS g ON g.IdGvari = og.IdGvari
            WHERE r.Data >= ? AND r.Data < ?
            GROUP BY g.Gvari, o.OrgDesc2, r.OrgT, r.ProdS, r.ProdT';

        $out = [];
        foreach ($this->select($sql, [$from, $toExclusive]) as $row) {
            $remembered = $this->remember($row);
            if ($remembered === null) {
                continue;
            }
            [$key, $presale, $supervisor, $channel, $category, $brand] = $remembered;
            if (! isset($out[$key])) {
                $out[$key] = [
                    'volume' => 0.0,
                    'presale' => $presale,
                    'supervisor' => $supervisor,
                    'channel' => $channel,
                    'category' => $category,
                    'brand' => $brand,
                ];
            }
            $out[$key]['volume'] += (float) $row->volume;
        }

        return $out;
    }

    /**
     * @return array<string, array{presale: string, supervisor: string, channel: string, category: string, brand: string, days: array<string, float>}>
     */
    private function volumesByDay(string $table, string $from, string $toExclusive): array
    {
        $sql = 'SELECT '
            .FmgNvarchar::col('g.Gvari', 'gvari_hex').', '
            .FmgNvarchar::col('o.OrgDesc2', 'orgdesc2_hex').', '
            .FmgNvarchar::col('r.OrgT', 'orgt_hex').', '
            .FmgNvarchar::col('r.ProdS', 'prods_hex').', '
            .FmgNvarchar::col('r.ProdT', 'prodt_hex').', '
            .'CONVERT(char(10), r.Data, 23) AS day, '
            .'SUM(CAST(r.TevadobaTotal AS float)) AS volume
            FROM '.$table.' AS r
            INNER JOIN (
                SELECT DISTINCT og.IdOrg, og.IdGvari
                FROM dbo.OrgGvariView AS og
                WHERE og.Active = 1
            ) AS og ON og.IdOrg = r.IdOrg
            INNER JOIN dbo.OrgView AS o ON o.IdOrg = og.IdOrg AND o.Active = 1 AND o.OrgDesc2 <> \'\'
            INNER JOIN dbo.GvariView AS g ON g.IdGvari = og.IdGvari
            WHERE r.Data >= ? AND r.Data < ?
            GROUP BY g.Gvari, o.OrgDesc2, r.OrgT, r.ProdS, r.ProdT, CONVERT(char(10), r.Data, 23)';

        $out = [];
        foreach ($this->select($sql, [$from, $toExclusive]) as $row) {
            $remembered = $this->remember($row);
            if ($remembered === null) {
                continue;
            }
            [$key, $presale, $supervisor, $channel, $category, $brand] = $remembered;
            $day = substr((string) $row->day, 0, 10);
            if (! isset($out[$key])) {
                $out[$key] = [
                    'presale' => $presale,
                    'supervisor' => $supervisor,
                    'channel' => $channel,
                    'category' => $category,
                    'brand' => $brand,
                    'days' => [],
                ];
            }
            $out[$key]['days'][$day] = ($out[$key]['days'][$day] ?? 0) + (float) $row->volume;
        }

        return $out;
    }

    /**
     * @return array{0: string, 1: string, 2: string, 3: string, 4: string, 5: string}|null
     */
    private function remember(object $row): ?array
    {
        $presale = trim(FmgNvarchar::decode($row->gvari_hex ?? null));
        $supervisor = trim(FmgNvarchar::decode($row->orgdesc2_hex ?? null));
        $channel = FmgNvarchar::decode($row->orgt_hex ?? null);
        $category = FmgNvarchar::decode($row->prods_hex ?? null);
        $brand = FmgNvarchar::decode($row->prodt_hex ?? null);
        if ($presale === '' || $supervisor === '' || str_starts_with($presale, '#') || str_starts_with($supervisor, '#')) {
            return null;
        }

        return [
            PlanScore::dimensionKey($presale, $channel, $category, $brand, $supervisor),
            $presale,
            $supervisor,
            $channel,
            $category,
            $brand,
        ];
    }

    /**
     * @param  list<mixed>  $bindings
     * @return list<object>
     */
    private function select(string $sql, array $bindings): array
    {
        try {
            return $this->fmg->connection()->select($sql, $bindings);
        } catch (Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }
    }

    private function nextDay(string $date): string
    {
        return (new DateTimeImmutable($date))->modify('+1 day')->format('Y-m-d');
    }
}
