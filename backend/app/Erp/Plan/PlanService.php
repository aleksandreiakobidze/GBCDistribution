<?php

namespace App\Erp\Plan;

use App\Enums\UserRole;
use App\Erp\Exceptions\ErpException;
use App\Erp\Fmg\ManagerTeamSync;
use App\Erp\Fmg\SupervisorTeamSync;
use App\Erp\Support\TeamAccess;
use App\Models\PlanFact;
use App\Models\PlanLine;
use App\Models\PlanUpload;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

final class PlanService
{
    public function __construct(
        private readonly PlanWorkbook $workbook,
        private readonly PlanActuals $actuals,
        private readonly SupervisorTeamSync $teams,
        private readonly ManagerTeamSync $managers,
    ) {}

    /**
     * @param  array<string, string|list<string>>  $filters
     * @return array<string, mixed>
     */
    public function show(User $actor, array $filters): array
    {
        $this->assertView($actor);
        $upload = PlanUpload::query()->orderByDesc('id')->first();
        if (! $upload) {
            return $this->emptyPayload($actor);
        }

        $own = $this->ownPresale($actor);
        $team = TeamAccess::isTeamLead($actor);
        $teamNames = $team ? $this->teamPresaleNames($actor) : null;
        $supervisorNames = $team ? $this->teamSupervisorNames($actor) : [];
        $lines = PlanLine::query()->where('upload_id', $upload->id)->orderBy('id')->get();
        $facts = [];
        foreach (PlanFact::query()->where('upload_id', $upload->id)->get() as $fact) {
            $facts[PlanScore::factKey(
                $fact->presale_key,
                $fact->channel_key,
                $fact->category_key,
                $fact->brand_key,
                $fact->starts_on->toDateString(),
                $fact->ends_on->toDateString(),
                (string) ($fact->supervisor_key ?? ''),
            )] = $fact;
        }

        $excel = [];
        foreach ($lines as $line) {
            $excel[] = $this->presentLine($line, $facts);
        }
        if ($team) {
            $excel = PlanScore::presaleRows($excel, $teamNames ?? []);
            $excel = PlanScore::supervisorRowsAny($excel, $supervisorNames);
        }
        $all = $this->withUnplanned($excel, $facts);

        $scoreFilters = [
            'region' => $this->filterList($filters['region'] ?? []),
            'supervisor' => $this->filterList($filters['supervisor'] ?? []),
            'channel' => $this->filterList($filters['channel'] ?? []),
            'category' => $this->filterList($filters['category'] ?? []),
            'brand' => $this->filterList($filters['brand'] ?? []),
        ];
        if ($own !== null) {
            $scoreFilters['region'] = [];
            $scoreFilters['supervisor'] = [];
        }
        if ($team) {
            $scoreFilters['supervisor'] = $supervisorNames;
        }
        if ($team) {
            $chosen = (string) ($filters['presaleChosen'] ?? '') === '1';
            $view = $chosen ? PlanScore::presaleRows($all, $this->filterList($filters['presale'] ?? [])) : $all;
            $anchor = '';
            $rows = PlanScore::teamLines($view, $scoreFilters);
            $ranking = PlanScore::teamRanking($view, $scoreFilters);
        } else {
            $requested = $filters['presale'] ?? '';
            $requestedName = is_array($requested) ? (string) ($requested[0] ?? '') : (string) $requested;
            $anchor = $this->anchorName($all, $own, $requestedName);
            $rows = PlanScore::detail($all, $anchor, $scoreFilters);
            $ranking = $anchor === '' ? [] : PlanScore::ranking($all, $anchor, $scoreFilters);
        }

        return [
            'upload' => [
                'id' => $upload->id,
                'name' => $upload->original_name,
                'uploadedAt' => $upload->created_at?->toIso8601String(),
                'computedAt' => $upload->computed_at?->toIso8601String(),
            ],
            'canUpload' => $this->canUpload($actor),
            'canRefresh' => $this->canRefresh($actor),
            'scope' => $this->scopeFor($actor, $own),
            'anchor' => $anchor === '' ? null : $anchor,
            'ranking' => $ranking,
            'choices' => $this->choices($all, $own, $anchor, $team, $scoreFilters['region'], $supervisorNames, $excel),
            'rows' => $rows,
            'totals' => PlanScore::totals(array_map(fn (array $row) => [
                'plan' => $row['plan'],
                'factKey' => $row['factKey'],
                'real' => $row['real'],
                'return' => $row['return'],
            ], $rows)),
        ];
    }

    /**
     * @param  array<string, PlanFact>  $facts
     * @return array{region: string, supervisor: string, presale: string, channel: string, category: string, brand: string, plan: float, real: float, return: float, net: float, percent: float|null, startsOn: string, endsOn: string, factKey: string}
     */
    private function presentLine(PlanLine $line, array $facts): array
    {
        $starts = $line->starts_on->toDateString();
        $ends = $line->ends_on->toDateString();
        $factKey = PlanScore::factKey(
            $line->presale,
            $line->channel,
            $line->category,
            $line->brand,
            $starts,
            $ends,
            (string) $line->supervisor,
        );
        $fact = $facts[$factKey] ?? null;
        $real = (float) ($fact->real_amount ?? 0);
        $return = (float) ($fact->return_amount ?? 0);
        $plan = (float) $line->plan_amount;
        $net = round($real - $return, 4);

        return [
            'region' => $line->region,
            'supervisor' => $line->supervisor,
            'presale' => $line->presale,
            'channel' => $line->channel,
            'category' => $line->category,
            'brand' => $line->brand,
            'plan' => $plan,
            'real' => $real,
            'return' => $return,
            'net' => $net,
            'percent' => PlanScore::percent($net, $plan),
            'startsOn' => $starts,
            'endsOn' => $ends,
            'factKey' => $factKey,
        ];
    }

    /**
     * Brands sold without a plan line still belong to that salesperson + OrgDesc2 pair.
     *
     * @param  list<array{region: string, supervisor: string, presale: string, channel: string, category: string, brand: string, plan: float, real: float, return: float, net: float, percent: float|null, startsOn: string, endsOn: string, factKey: string}>  $rows
     * @param  array<string, PlanFact>  $facts
     * @return list<array{region: string, supervisor: string, presale: string, channel: string, category: string, brand: string, plan: float, real: float, return: float, net: float, percent: float|null, startsOn: string, endsOn: string, factKey: string}>
     */
    private function withUnplanned(array $rows, array $facts): array
    {
        $known = [];
        $people = [];
        foreach ($rows as $row) {
            $known[$row['factKey']] = true;
            $pair = PlanScore::normalize($row['presale'])."\x1e".PlanScore::normalize($row['supervisor']);
            $people[$pair] ??= $row;
        }
        foreach ($facts as $key => $fact) {
            if (isset($known[$key])) {
                continue;
            }
            $pair = PlanScore::normalize($fact->presale_key)."\x1e".PlanScore::normalize((string) ($fact->supervisor_key ?? ''));
            $person = $people[$pair] ?? null;
            if ($person === null) {
                continue;
            }
            $real = round((float) $fact->real_amount, 4);
            $return = round((float) $fact->return_amount, 4);
            if (abs($real) < 0.0000001 && abs($return) < 0.0000001) {
                continue;
            }
            $rows[] = [
                'region' => $person['region'],
                'supervisor' => $person['supervisor'],
                'presale' => $person['presale'],
                'channel' => $fact->channel_key,
                'category' => $fact->category_key,
                'brand' => $fact->brand_key,
                'plan' => 0.0,
                'real' => $real,
                'return' => $return,
                'net' => round($real - $return, 4),
                'percent' => null,
                'startsOn' => $fact->starts_on->toDateString(),
                'endsOn' => $fact->ends_on->toDateString(),
                'factKey' => $key,
            ];
            $known[$key] = true;
        }

        return $rows;
    }

    /**
     * @param  list<array{presale: string}>  $rows
     */
    private function anchorName(array $rows, ?string $own, string $requested): string
    {
        if ($own === '') {
            return '';
        }
        $wanted = $own ?? $requested;
        $wantedNorm = PlanScore::normalize($wanted);
        if ($wantedNorm === '') {
            return '';
        }
        foreach ($rows as $row) {
            if (PlanScore::normalize($row['presale']) === $wantedNorm) {
                return $row['presale'];
            }
        }

        return '';
    }

    /**
     * @param  list<array{region: string, supervisor: string, presale: string, channel: string, category: string, brand: string}>  $all
     * @param  list<array{region: string, supervisor: string, channel: string}>  $excel
     * @param  list<string>  $regions
     * @param  list<string>  $supervisorNames
     * @return array{regions: list<string>, supervisors: list<string>, presales: list<string>, channels: list<string>, categories: list<string>, brands: list<string>, catalog: list<array{category: string, brand: string}>}
     */
    private function choices(array $all, ?string $own, string $anchor, bool $team = false, array $regions = [], array $supervisorNames = [], array $excel = []): array
    {
        if ($team) {
            $narrowed = $this->rowsInRegions($all, $regions);
            $owned = PlanScore::supervisorRowsAny($excel, $supervisorNames);
            $ownedInRegion = $this->rowsInRegions($owned, $regions);

            return [
                'regions' => $this->distinct($owned, 'region'),
                'supervisors' => $this->distinct($all, 'supervisor'),
                'presales' => $this->distinct($narrowed, 'presale'),
                'channels' => $this->distinct($ownedInRegion, 'channel'),
                'categories' => $this->distinct($narrowed, 'category'),
                'brands' => $this->distinct($narrowed, 'brand'),
                'catalog' => $this->catalog($narrowed),
            ];
        }

        $source = $all;
        if ($own !== null) {
            $channels = [];
            $anchorNorm = PlanScore::normalize($anchor);
            foreach ($all as $row) {
                if (PlanScore::normalize($row['presale']) === $anchorNorm && $anchorNorm !== '') {
                    $channel = PlanScore::normalize($row['channel']);
                    if ($channel !== '') {
                        $channels[$channel] = true;
                    }
                }
            }
            $source = array_values(array_filter(
                $all,
                fn (array $row) => isset($channels[PlanScore::normalize($row['channel'])])
                    || (PlanScore::normalize($row['channel']) === '' && PlanScore::normalize($row['presale']) === $anchorNorm),
            ));
        }

        return [
            'regions' => $this->distinct($source, 'region'),
            'supervisors' => $this->distinct($source, 'supervisor'),
            'presales' => $own !== null
                ? ($anchor === '' ? [] : [$anchor])
                : $this->distinct($all, 'presale'),
            'channels' => $this->distinct($own !== null ? $source : $all, 'channel'),
            'categories' => $this->distinct($source, 'category'),
            'brands' => $this->distinct($source, 'brand'),
            'catalog' => $this->catalog($source),
        ];
    }

    /**
     * @param  list<array{category: string, brand: string}>  $rows
     * @return list<array{category: string, brand: string}>
     */
    private function catalog(array $rows): array
    {
        $categories = [];
        foreach ($this->distinct($rows, 'category') as $value) {
            $categories[PlanScore::normalize($value)] = $value;
        }
        $brands = [];
        foreach ($this->distinct($rows, 'brand') as $value) {
            $brands[PlanScore::normalize($value)] = $value;
        }
        $seen = [];
        $pairs = [];
        foreach ($rows as $row) {
            $categoryNorm = PlanScore::normalize((string) ($row['category'] ?? ''));
            $brandNorm = PlanScore::normalize((string) ($row['brand'] ?? ''));
            $key = $categoryNorm."\x1e".$brandNorm;
            if ($categoryNorm === '' || $brandNorm === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $pairs[] = [
                'category' => $categories[$categoryNorm],
                'brand' => $brands[$brandNorm],
            ];
        }
        usort($pairs, function (array $left, array $right): int {
            $category = strnatcasecmp($left['category'], $right['category']);

            return $category !== 0 ? $category : strnatcasecmp($left['brand'], $right['brand']);
        });

        return $pairs;
    }

    /**
     * @param  string|list<mixed>  $value
     * @return list<string>
     */
    private function filterList(string|array $value): array
    {
        $items = is_array($value) ? $value : ($value === '' ? [] : [$value]);
        $out = [];
        foreach ($items as $item) {
            if (is_string($item) && trim($item) !== '') {
                $out[] = $item;
            }
        }

        return array_values($out);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<string>
     */
    private function distinct(array $rows, string $key): array
    {
        $seen = [];
        $values = [];
        foreach ($rows as $row) {
            $value = trim((string) ($row[$key] ?? ''));
            $norm = PlanScore::normalize($value);
            if ($norm === '' || isset($seen[$norm])) {
                continue;
            }
            $seen[$norm] = true;
            $values[] = $value;
        }
        usort($values, fn (string $a, string $b) => strnatcasecmp($a, $b));

        return $values;
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyPayload(User $actor): array
    {
        return [
            'upload' => null,
            'canUpload' => $this->canUpload($actor),
            'canRefresh' => $this->canRefresh($actor),
            'scope' => $this->scopeFor($actor, $this->ownPresale($actor)),
            'anchor' => null,
            'ranking' => [],
            'choices' => [
                'regions' => [],
                'supervisors' => [],
                'presales' => [],
                'channels' => [],
                'categories' => [],
                'brands' => [],
                'catalog' => [],
            ],
            'rows' => [],
        ];
    }

    public function store(User $actor, UploadedFile $file): array
    {
        $this->assertUpload($actor);
        $extension = strtolower($file->getClientOriginalExtension());
        if ($extension !== 'xlsx') {
            throw new ErpException('PLAN_FILE', 'ატვირთე .xlsx ფაილი.', 422);
        }
        set_time_limit(300);
        $stored = $this->keepWorkbook($file);
        try {
            $parsed = $this->workbook->read(storage_path('app/'.$stored));
            $facts = $this->actuals->forLines($parsed);
            $this->persist($actor, $file->getClientOriginalName(), $parsed, $facts, $stored);
        } catch (Throwable $error) {
            $this->deleteStored($stored);
            throw $error;
        }

        return $this->show($actor, []);
    }

    public function refresh(User $actor): array
    {
        $this->assertRefresh($actor);
        $this->teams->relink();
        $this->managers->relink();
        $upload = PlanUpload::query()->orderByDesc('id')->first();
        if (! $upload) {
            throw new ErpException('PLAN_EMPTY', 'ჯერ Excel ატვირთე.', 422);
        }
        set_time_limit(300);
        $stored = $this->absoluteStored($upload->stored_path);
        if ($stored !== null) {
            $parsed = $this->workbook->read($stored);
            $facts = $this->actuals->forLines($parsed);
            DB::transaction(function () use ($upload, $parsed, $facts) {
                PlanLine::query()->where('upload_id', $upload->id)->delete();
                $this->insertLines($upload->id, $parsed);
                PlanFact::query()->where('upload_id', $upload->id)->delete();
                $this->insertFacts($upload->id, $facts);
                $upload->computed_at = now();
                $upload->save();
            });

            return $this->show($actor, []);
        }

        $lines = [];
        foreach ($upload->lines()->orderBy('id')->get() as $line) {
            $lines[] = [
                'presale' => $line->presale,
                'supervisor' => $line->supervisor,
                'channel' => $line->channel,
                'category' => $line->category,
                'brand' => $line->brand,
                'startsOn' => $line->starts_on->toDateString(),
                'endsOn' => $line->ends_on->toDateString(),
            ];
        }
        $facts = $this->actuals->forLines($lines);
        DB::transaction(function () use ($upload, $facts) {
            PlanFact::query()->where('upload_id', $upload->id)->delete();
            $this->insertFacts($upload->id, $facts);
            $upload->computed_at = now();
            $upload->save();
        });

        return $this->show($actor, []);
    }

    /**
     * @param  list<array{region: string, supervisor: string, presale: string, channel: string, category: string, brand: string, plan: float, startsOn: string, endsOn: string}>  $lines
     * @param  array<string, array{real: float, return: float, presale: string, channel: string, category: string, brand: string, startsOn: string, endsOn: string}>  $facts
     */
    private function persist(User $actor, string $name, array $lines, array $facts, ?string $storedPath = null): void
    {
        $previous = PlanUpload::query()->pluck('stored_path')->filter()->all();
        DB::transaction(function () use ($actor, $name, $lines, $facts, $storedPath) {
            PlanFact::query()->delete();
            PlanLine::query()->delete();
            PlanUpload::query()->delete();
            $upload = PlanUpload::query()->create([
                'uploaded_by' => $actor->id,
                'original_name' => $name !== '' ? $name : 'plan.xlsx',
                'stored_path' => $storedPath,
                'computed_at' => now(),
            ]);
            $this->insertLines($upload->id, $lines);
            $this->insertFacts($upload->id, $facts);
        });
        foreach ($previous as $path) {
            if ($path !== $storedPath) {
                $this->deleteStored((string) $path);
            }
        }
    }

    /**
     * @param  list<array{region: string, supervisor: string, presale: string, channel: string, category: string, brand: string, plan: float, startsOn: string, endsOn: string}>  $lines
     */
    private function insertLines(int $uploadId, array $lines): void
    {
        $nowRows = [];
        foreach ($lines as $line) {
            $nowRows[] = [
                'upload_id' => $uploadId,
                'region' => $line['region'],
                'supervisor' => $line['supervisor'],
                'presale' => $line['presale'],
                'channel' => $line['channel'],
                'category' => $line['category'],
                'brand' => $line['brand'],
                'plan_amount' => $line['plan'],
                'starts_on' => $line['startsOn'],
                'ends_on' => $line['endsOn'],
            ];
        }
        foreach (array_chunk($nowRows, 400) as $chunk) {
            PlanLine::query()->insert($chunk);
        }
    }

    /**
     * @param  array<string, array{real: float, return: float, presale: string, channel: string, category: string, brand: string, startsOn: string, endsOn: string}>  $facts
     */
    private function insertFacts(int $uploadId, array $facts): void
    {
        $rows = [];
        foreach ($facts as $fact) {
            $rows[] = [
                'upload_id' => $uploadId,
                'presale_key' => $fact['presale'],
                'supervisor_key' => (string) ($fact['supervisor'] ?? ''),
                'channel_key' => $fact['channel'],
                'category_key' => $fact['category'],
                'brand_key' => $fact['brand'],
                'starts_on' => $fact['startsOn'],
                'ends_on' => $fact['endsOn'],
                'real_amount' => $fact['real'],
                'return_amount' => $fact['return'],
            ];
        }
        foreach (array_chunk($rows, 400) as $chunk) {
            PlanFact::query()->insert($chunk);
        }
    }

    private function assertView(User $actor): void
    {
        $role = TeamAccess::role($actor);
        if (! in_array($role, [UserRole::Admin, UserRole::Supervisor, UserRole::Manager, UserRole::SalesRep], true)) {
            TeamAccess::deny();
        }
    }

    private function assertUpload(User $actor): void
    {
        TeamAccess::assertSupervisor($actor);
    }

    private function assertRefresh(User $actor): void
    {
        if (! $this->canRefresh($actor)) {
            TeamAccess::deny();
        }
    }

    private function canUpload(User $actor): bool
    {
        $role = TeamAccess::role($actor);

        return $role === UserRole::Admin || $role === UserRole::Supervisor || $role === UserRole::Manager;
    }

    private function canRefresh(User $actor): bool
    {
        $role = TeamAccess::role($actor);

        return in_array($role, [UserRole::Admin, UserRole::Supervisor, UserRole::Manager, UserRole::SalesRep], true);
    }

    private function keepWorkbook(UploadedFile $file): string
    {
        $directory = storage_path('app/plans');
        if (! is_dir($directory) && ! mkdir($directory, 0775, true) && ! is_dir($directory)) {
            throw new ErpException('PLAN_FILE', 'Excel ვერ შეინახა.', 500);
        }
        $relative = 'plans/plan-'.now()->format('YmdHis').'-'.bin2hex(random_bytes(4)).'.xlsx';
        $target = storage_path('app/'.$relative);
        $source = $file->getRealPath();
        if ($source === false || ! copy($source, $target)) {
            throw new ErpException('PLAN_FILE', 'Excel ვერ შეინახა.', 500);
        }

        return $relative;
    }

    private function absoluteStored(?string $relative): ?string
    {
        if ($relative === null || $relative === '' || str_contains($relative, '..')) {
            return null;
        }
        $path = storage_path('app/'.str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relative));

        return is_file($path) ? $path : null;
    }

    private function deleteStored(?string $relative): void
    {
        $path = $this->absoluteStored($relative);
        if ($path !== null) {
            unlink($path);
        }
    }

    private function scopeFor(User $actor, ?string $own): string
    {
        if (TeamAccess::isTeamLead($actor)) {
            return 'supervisor';
        }
        if ($own === null) {
            return 'all';
        }

        return $own === '' ? 'unmapped' : 'presale';
    }

    /**
     * @return list<string>
     */
    private function teamSupervisorNames(User $actor): array
    {
        if (TeamAccess::role($actor) === UserRole::Supervisor) {
            return [(string) $actor->name];
        }

        $ids = User::query()
            ->whereIn('id', function ($sub) use ($actor): void {
                $sub->select('supervisor_user_id')
                    ->from('manager_supervisors')
                    ->where('manager_user_id', $actor->id);
            })
            ->pluck('name')
            ->map(fn ($name) => (string) $name)
            ->all();

        return $ids;
    }

    /**
     * @param  list<array{presale: string, region: string}>  $rows
     * @param  list<string>  $regions
     */
    private function presaleMatchesRegions(array $rows, string $anchor, array $regions): bool
    {
        $anchorNorm = PlanScore::normalize($anchor);
        foreach ($this->rowsInRegions($rows, $regions) as $row) {
            if (PlanScore::normalize($row['presale']) === $anchorNorm) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<array{region?: string}>  $rows
     * @param  list<string>  $regions
     * @return list<array{region?: string}>
     */
    private function rowsInRegions(array $rows, array $regions): array
    {
        $selected = [];
        foreach ($regions as $region) {
            $norm = PlanScore::normalize((string) $region);
            if ($norm !== '') {
                $selected[$norm] = true;
            }
        }
        if ($selected === []) {
            return $rows;
        }

        return array_values(array_filter(
            $rows,
            fn (array $row) => isset($selected[PlanScore::normalize((string) ($row['region'] ?? ''))]),
        ));
    }

    /**
     * @return list<string>
     */
    private function teamPresaleNames(User $actor): array
    {
        $ids = TeamAccess::salesUserIds($actor) ?? [];

        return User::query()
            ->whereIn('id', $ids === [] ? [-1] : $ids)
            ->pluck('name')
            ->map(fn ($name) => (string) $name)
            ->all();
    }

    /**
     * Null means the viewer sees every row. An empty string means the preseller is not mapped.
     */
    private function ownPresale(User $actor): ?string
    {
        if (TeamAccess::role($actor) !== UserRole::SalesRep) {
            return null;
        }
        $id = (int) $actor->id_gvari;
        if ($id <= 0) {
            return '';
        }

        return $this->actuals->gvariName($id) ?? '';
    }
}
