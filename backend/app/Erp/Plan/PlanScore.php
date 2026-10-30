<?php

namespace App\Erp\Plan;

/**
 * Matches a plan row to Power BI volume and keeps a repeated key from being counted twice.
 */
final class PlanScore
{
    public static function normalize(string $value): string
    {
        $value = trim($value);
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;

        return mb_strtolower($value, 'UTF-8');
    }

    /**
     * Rows whose supervisor matches the viewer's name.
     *
     * @param  list<array{supervisor?: string}>  $rows
     * @return list<array{supervisor?: string}>
     */
    public static function supervisorRows(array $rows, string $name): array
    {
        return self::supervisorRowsAny($rows, [$name]);
    }

    /**
     * Rows whose supervisor matches any of the given names.
     *
     * @param  list<array{supervisor?: string}>  $rows
     * @param  list<string>  $names
     * @return list<array{supervisor?: string}>
     */
    public static function supervisorRowsAny(array $rows, array $names): array
    {
        $wanted = [];
        foreach ($names as $name) {
            $key = self::normalize((string) $name);
            if ($key !== '') {
                $wanted[$key] = true;
            }
        }
        if ($wanted === []) {
            return [];
        }
        $team = [];
        foreach ($rows as $row) {
            if (isset($wanted[self::normalize((string) ($row['supervisor'] ?? ''))])) {
                $team[] = $row;
            }
        }

        return $team;
    }

    /**
     * Plan rows whose salesperson is one of the named people.
     *
     * @param  list<array{presale?: string}>  $rows
     * @param  list<string>  $names
     * @return list<array{presale?: string}>
     */
    public static function presaleRows(array $rows, array $names): array
    {
        $wanted = [];
        foreach ($names as $name) {
            $norm = self::normalize((string) $name);
            if ($norm !== '') {
                $wanted[$norm] = true;
            }
        }
        if ($wanted === []) {
            return [];
        }
        $team = [];
        foreach ($rows as $row) {
            if (isset($wanted[self::normalize((string) ($row['presale'] ?? ''))])) {
                $team[] = $row;
            }
        }

        return $team;
    }

    public static function detailKey(
        string $region,
        string $supervisor,
        string $presale,
        string $channel,
        string $category,
        string $brand,
    ): string {
        return implode("\x1e", [
            self::normalize($region),
            self::normalize($supervisor),
            self::normalize($presale),
            self::normalize($channel),
            self::normalize($category),
            self::normalize($brand),
        ]);
    }

    public static function dimensionKey(
        string $presale,
        string $channel,
        string $category,
        string $brand,
        string $supervisor = '',
    ): string {
        return implode("\x1e", [
            self::normalize($presale),
            self::normalize($supervisor),
            self::normalize($channel),
            self::normalize($category),
            self::normalize($brand),
        ]);
    }

    public static function brandKey(
        string $presale,
        string $category,
        string $brand,
        string $startsOn = '',
        string $endsOn = '',
    ): string {
        $key = implode("\x1e", [
            self::normalize($presale),
            self::normalize($category),
            self::normalize($brand),
        ]);
        if ($startsOn !== '') {
            $key .= "\x1e".$startsOn."\x1e".$endsOn;
        }

        return $key;
    }

    public static function factKey(
        string $presale,
        string $channel,
        string $category,
        string $brand,
        string $startsOn,
        string $endsOn,
        string $supervisor = '',
    ): string {
        return self::dimensionKey($presale, $channel, $category, $brand, $supervisor)."\x1e".$startsOn."\x1e".$endsOn;
    }

    public static function percent(float $net, float $plan): ?float
    {
        if (abs($plan) < 0.0000001) {
            return null;
        }

        return round($net / $plan * 100, 1);
    }

    /**
     * @param  list<array{plan: float, factKey: string, real: float, return: float}>  $rows
     * @return array{plan: float, real: float, return: float, net: float, percent: float|null}
     */
    public static function totals(array $rows): array
    {
        $plan = 0.0;
        $real = 0.0;
        $return = 0.0;
        $seen = [];
        foreach ($rows as $row) {
            $plan += $row['plan'];
            if (isset($seen[$row['factKey']])) {
                continue;
            }
            $seen[$row['factKey']] = true;
            $real += $row['real'];
            $return += $row['return'];
        }
        $net = $real - $return;

        return [
            'plan' => round($plan, 4),
            'real' => round($real, 4),
            'return' => round($return, 4),
            'net' => round($net, 4),
            'percent' => self::percent($net, $plan),
        ];
    }

    /**
     * People who share a channel where both plans are above zero, ranked by percent.
     *
     * @param  list<array{presale: string, channel: string, region: string, supervisor: string, category: string, brand: string, plan: float, real: float, return: float, factKey: string}>  $rows
     * @param  array{region?: string|list<string>, supervisor?: string|list<string>, channel?: string|list<string>, category?: string|list<string>, brand?: string|list<string>}  $filters
     * @return list<array{rank: int, presale: string, plan: float, real: float, return: float, net: float, percent: float|null, self: bool}>
     */
    public static function ranking(array $rows, string $anchor, array $filters): array
    {
        $anchorNorm = self::normalize($anchor);
        $scoped = [];
        foreach ($rows as $row) {
            if (self::filterMatches($row, $filters)) {
                $scoped[] = $row;
            }
        }
        $positive = self::positiveChannels($scoped);
        $cohort = self::cohortChannels($positive[$anchorNorm] ?? [], $filters['channel'] ?? []);
        if ($cohort === []) {
            return [];
        }

        $groups = [];
        $eligible = [];
        foreach ($scoped as $row) {
            $channel = self::normalize($row['channel']);
            $key = self::normalize($row['presale']);
            if ($key === '' || $channel === '' || ! isset($cohort[$channel]) || ! isset($positive[$key][$channel])) {
                continue;
            }
            $eligible[$key] = $row['presale'];
        }
        foreach ($scoped as $row) {
            $key = self::normalize($row['presale']);
            $channel = self::normalize($row['channel']);
            if (! isset($eligible[$key]) || $channel === '' || ! isset($cohort[$channel])) {
                continue;
            }
            if (! isset($groups[$key])) {
                $groups[$key] = ['presale' => $eligible[$key], 'lines' => []];
            }
            $groups[$key]['lines'][] = [
                'plan' => (float) $row['plan'],
                'factKey' => $row['factKey'],
                'real' => (float) $row['real'],
                'return' => (float) $row['return'],
            ];
        }

        $people = [];
        foreach ($groups as $key => $group) {
            $totals = self::totals($group['lines']);
            $people[] = [
                'presale' => $group['presale'],
                'plan' => $totals['plan'],
                'real' => $totals['real'],
                'return' => $totals['return'],
                'net' => $totals['net'],
                'percent' => $totals['percent'],
                'self' => $key === $anchorNorm,
            ];
        }

        usort($people, function (array $a, array $b): int {
            if ($a['percent'] === null && $b['percent'] !== null) {
                return 1;
            }
            if ($b['percent'] === null && $a['percent'] !== null) {
                return -1;
            }
            if ($a['percent'] !== $b['percent']) {
                return $b['percent'] <=> $a['percent'];
            }
            if ($a['net'] !== $b['net']) {
                return $b['net'] <=> $a['net'];
            }

            return strcmp($a['presale'], $b['presale']);
        });

        $ranked = [];
        foreach ($people as $index => $person) {
            $person['rank'] = $index + 1;
            $ranked[] = $person;
        }

        return $ranked;
    }

    /**
     * Detail lines for one salesperson. Channel and the other filters apply; other presales do not.
     *
     * @param  list<array{presale: string, channel: string, region: string, supervisor: string, category: string, brand: string, plan: float, real: float, return: float, factKey: string}>  $rows
     * @param  array{region?: string|list<string>, supervisor?: string|list<string>, channel?: string|list<string>, category?: string|list<string>, brand?: string|list<string>}  $filters
     * @return list<array{presale: string, channel: string, region: string, supervisor: string, category: string, brand: string, plan: float, real: float, return: float, factKey: string}>
     */
    public static function detail(array $rows, string $anchor, array $filters): array
    {
        $anchorNorm = self::normalize($anchor);
        if ($anchorNorm === '') {
            return [];
        }
        $channels = self::selected($filters['channel'] ?? []);
        $out = [];
        foreach ($rows as $row) {
            if (self::normalize($row['presale']) !== $anchorNorm) {
                continue;
            }
            $channel = self::normalize($row['channel']);
            if ($channels !== [] && ! isset($channels[$channel])) {
                continue;
            }
            if (! self::filterMatches($row, $filters)) {
                continue;
            }
            $out[] = $row;
        }

        $grouped = [];
        $seen = [];
        foreach ($out as $row) {
            $key = self::brandKey($row['presale'], (string) $row['category'], (string) $row['brand']);
            if (! isset($grouped[$key])) {
                $grouped[$key] = $row;
                $grouped[$key]['plan'] = 0.0;
                $grouped[$key]['real'] = 0.0;
                $grouped[$key]['return'] = 0.0;
                $grouped[$key]['factKey'] = $key;
            }
            $grouped[$key]['plan'] += (float) $row['plan'];
            $fact = (string) ($row['factKey'] ?? '');
            if (isset($seen[$key][$fact])) {
                continue;
            }
            $seen[$key][$fact] = true;
            $grouped[$key]['real'] += (float) ($row['real'] ?? 0);
            $grouped[$key]['return'] += (float) ($row['return'] ?? 0);
        }
        foreach ($grouped as $key => $row) {
            $plan = round((float) $row['plan'], 4);
            $real = round((float) ($row['real'] ?? 0), 4);
            $return = round((float) ($row['return'] ?? 0), 4);
            $net = round($real - $return, 4);
            $grouped[$key]['plan'] = $plan;
            $grouped[$key]['real'] = $real;
            $grouped[$key]['return'] = $return;
            $grouped[$key]['net'] = $net;
            $grouped[$key]['percent'] = self::percent($net, $plan);
        }

        return array_values($grouped);
    }

    /**
     * Every selected salesperson, with the same filters on the lines and the rank.
     *
     * @param  list<array{presale: string, channel: string, region: string, supervisor: string, category: string, brand: string, plan: float, real: float, return: float, factKey: string}>  $rows
     * @param  array{region?: string|list<string>, supervisor?: string|list<string>, channel?: string|list<string>, category?: string|list<string>, brand?: string|list<string>}  $filters
     * @return list<array{presale: string, channel: string, region: string, supervisor: string, category: string, brand: string, plan: float, real: float, return: float, net: float, percent: float|null, factKey: string}>
     */
    public static function teamLines(array $rows, array $filters): array
    {
        $channels = self::selected($filters['channel'] ?? []);
        $out = [];
        foreach ($rows as $row) {
            $channel = self::normalize($row['channel']);
            if ($channels !== [] && ! isset($channels[$channel])) {
                continue;
            }
            if (! self::filterMatches($row, $filters)) {
                continue;
            }
            $out[] = $row;
        }

        $grouped = [];
        $seen = [];
        foreach ($out as $row) {
            $key = self::brandKey($row['presale'], (string) $row['category'], (string) $row['brand']);
            if (! isset($grouped[$key])) {
                $grouped[$key] = $row;
                $grouped[$key]['plan'] = 0.0;
                $grouped[$key]['real'] = 0.0;
                $grouped[$key]['return'] = 0.0;
                $grouped[$key]['factKey'] = $key;
            }
            $grouped[$key]['plan'] += (float) $row['plan'];
            $fact = (string) ($row['factKey'] ?? '');
            if (isset($seen[$key][$fact])) {
                continue;
            }
            $seen[$key][$fact] = true;
            $grouped[$key]['real'] += (float) ($row['real'] ?? 0);
            $grouped[$key]['return'] += (float) ($row['return'] ?? 0);
        }
        foreach ($grouped as $key => $row) {
            $plan = round((float) $row['plan'], 4);
            $real = round((float) ($row['real'] ?? 0), 4);
            $return = round((float) ($row['return'] ?? 0), 4);
            $net = round($real - $return, 4);
            $grouped[$key]['plan'] = $plan;
            $grouped[$key]['real'] = $real;
            $grouped[$key]['return'] = $return;
            $grouped[$key]['net'] = $net;
            $grouped[$key]['percent'] = self::percent($net, $plan);
        }

        $lines = array_values($grouped);
        usort($lines, function (array $left, array $right): int {
            $name = strnatcasecmp((string) $left['presale'], (string) $right['presale']);
            if ($name !== 0) {
                return $name;
            }
            $category = strnatcasecmp((string) $left['category'], (string) $right['category']);

            return $category !== 0 ? $category : strnatcasecmp((string) $left['brand'], (string) $right['brand']);
        });

        return $lines;
    }

    /**
     * @param  list<array{presale: string, channel: string, region: string, supervisor: string, category: string, brand: string, plan: float, real: float, return: float, factKey: string}>  $rows
     * @param  array{region?: string|list<string>, supervisor?: string|list<string>, channel?: string|list<string>, category?: string|list<string>, brand?: string|list<string>}  $filters
     * @return list<array{rank: int, presale: string, plan: float, real: float, return: float, net: float, percent: float|null, self: bool}>
     */
    public static function teamRanking(array $rows, array $filters): array
    {
        $groups = [];
        foreach (self::teamLines($rows, $filters) as $row) {
            $key = self::normalize($row['presale']);
            if ($key === '') {
                continue;
            }
            if (! isset($groups[$key])) {
                $groups[$key] = ['presale' => $row['presale'], 'lines' => []];
            }
            $groups[$key]['lines'][] = [
                'plan' => (float) $row['plan'],
                'factKey' => (string) $row['factKey'],
                'real' => (float) $row['real'],
                'return' => (float) $row['return'],
            ];
        }

        $people = [];
        foreach ($groups as $group) {
            $totals = self::totals($group['lines']);
            $people[] = [
                'presale' => $group['presale'],
                'plan' => $totals['plan'],
                'real' => $totals['real'],
                'return' => $totals['return'],
                'net' => $totals['net'],
                'percent' => $totals['percent'],
                'self' => false,
            ];
        }

        usort($people, function (array $left, array $right): int {
            if ($left['percent'] === null && $right['percent'] !== null) {
                return 1;
            }
            if ($right['percent'] === null && $left['percent'] !== null) {
                return -1;
            }
            if ($left['percent'] !== $right['percent']) {
                return $right['percent'] <=> $left['percent'];
            }
            if ($left['net'] !== $right['net']) {
                return $right['net'] <=> $left['net'];
            }

            return strnatcasecmp($left['presale'], $right['presale']);
        });

        $ranked = [];
        foreach ($people as $index => $person) {
            $person['rank'] = $index + 1;
            $ranked[] = $person;
        }

        return $ranked;
    }

    /**
     * Channels whose plan total is above zero, keyed by the normalized presale.
     *
     * @param  list<array{presale: string, channel: string, plan: float}>  $rows
     * @return array<string, array<string, true>>
     */
    private static function positiveChannels(array $rows): array
    {
        $sums = [];
        foreach ($rows as $row) {
            $presale = self::normalize($row['presale']);
            $channel = self::normalize($row['channel']);
            if ($presale === '' || $channel === '') {
                continue;
            }
            $sums[$presale][$channel] = ($sums[$presale][$channel] ?? 0) + (float) $row['plan'];
        }
        $positive = [];
        foreach ($sums as $presale => $channels) {
            foreach ($channels as $channel => $plan) {
                if ($plan > 0) {
                    $positive[$presale][$channel] = true;
                }
            }
        }

        return $positive;
    }

    /**
     * @param  array<string, true>  $anchorChannels
     * @param  string|list<string>  $channelFilter
     * @return array<string, true>
     */
    private static function cohortChannels(array $anchorChannels, string|array $channelFilter): array
    {
        $filters = self::selected($channelFilter);
        if ($filters === []) {
            return $anchorChannels;
        }

        return array_intersect_key($anchorChannels, $filters);
    }

    /**
     * @param  array{region?: string, supervisor?: string, category?: string, brand?: string}  $row
     * @param  array{region?: string|list<string>, supervisor?: string|list<string>, category?: string|list<string>, brand?: string|list<string>}  $filters
     */
    private static function filterMatches(array $row, array $filters): bool
    {
        foreach (['region', 'supervisor', 'category', 'brand'] as $key) {
            $selected = self::selected($filters[$key] ?? []);
            if ($selected !== [] && ! isset($selected[self::normalize((string) ($row[$key] ?? ''))])) {
                return false;
            }
        }

        return true;
    }

    /**
     * An empty value matches every row. A string or a list matches any selected value.
     *
     * @param  string|list<string>  $value
     * @return array<string, true>
     */
    private static function selected(string|array $value): array
    {
        $items = is_array($value) ? $value : ($value === '' ? [] : [$value]);
        $selected = [];
        foreach ($items as $item) {
            $norm = self::normalize((string) $item);
            if ($norm !== '') {
                $selected[$norm] = true;
            }
        }

        return $selected;
    }
}
