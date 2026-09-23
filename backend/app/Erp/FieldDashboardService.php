<?php

namespace App\Erp;

use App\Enums\UserRole;
use App\Erp\Contracts\ErpProvider;
use App\Erp\Support\TbilisiClock;
use App\Erp\Support\TeamAccess;
use App\Models\ErpPromoPlan;
use App\Models\ErpSavedOrder;
use App\Models\ErpTask;
use App\Models\ErpVisit;
use App\Models\ErpVisitCoaching;
use App\Models\ErpVisitPhoto;
use App\Models\ErpVisitSurvey;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

final class FieldDashboardService
{
    private const TREND_DAYS = 7;

    public function __construct(private readonly ErpProvider $erp) {}

    /**
     * One request for every number the supervisor and the sales rep dashboards show.
     *
     * @return array<string, mixed>
     */
    public function overview(User $actor): array
    {
        $role = TeamAccess::role($actor);
        $now = Carbon::now('Asia/Tbilisi');
        $start = $now->copy()->startOfDay();
        $end = $now->copy()->endOfDay();

        $sales = $this->teamMembers($actor);
        $ids = $sales->pluck('id')->map(fn ($id) => (int) $id)->all();

        $visits = ErpVisit::query()
            ->whereIn('user_id', $ids === [] ? [-1] : $ids)
            ->whereBetween('started_at', [$start, $end])
            ->orderBy('started_at')
            ->get();

        $planned = [];
        foreach ($sales as $member) {
            $planned[(int) $member->id] = $this->plannedToday($member);
        }

        $tasks = ErpTask::query()
            ->with(['assignee', 'checker'])
            ->whereIn('user_id', $ids === [] ? [-1] : $ids)
            ->get();

        $photos = ErpVisitPhoto::query()
            ->whereIn('user_id', $ids === [] ? [-1] : $ids)
            ->get(['id', 'user_id', 'taken_at', 'reviewed_at', 'customer_name', 'phase']);

        $surveys = ErpVisitSurvey::query()
            ->whereIn('visit_id', $visits->pluck('id')->all() ?: [-1])
            ->get();

        $promos = ErpPromoPlan::query()
            ->whereIn('user_id', $ids === [] ? [-1] : $ids)
            ->whereDate('starts_on', '<=', $now->toDateString())
            ->whereDate('ends_on', '>=', $now->toDateString())
            ->get();

        $today = $now->toDateString();
        $team = $sales->map(function (User $member) use ($visits, $tasks, $photos, $planned, $today) {
            $id = (int) $member->id;
            $mine = $visits->where('user_id', $id);
            $visited = $mine->filter(fn (ErpVisit $visit) => $visit->status !== ErpVisit::STATUS_OPEN)
                ->pluck('customer_id')->unique()->count();
            $myTasks = $tasks->where('user_id', $id);
            $plan = $planned[$id] ?? 0;

            return [
                'salesUserId' => $id,
                'salesName' => $member->name,
                'planned' => $plan,
                'visited' => $visited,
                'coverage' => $plan > 0 ? (int) round(($visited / $plan) * 100) : 0,
                'openTasks' => $myTasks->where('status', ErpTask::STATUS_OPEN)->count(),
                'doneTasks' => $myTasks->where('status', ErpTask::STATUS_DONE)->whereNull('checked_at')->count(),
                'checkedTasks' => $myTasks->whereNotNull('checked_at')->count(),
                'unreviewedPhotos' => $photos->where('user_id', $id)->whereNull('reviewed_at')->count(),
                'photosToday' => $photos->where('user_id', $id)
                    ->filter(fn (ErpVisitPhoto $photo) => $photo->taken_at?->format('Y-m-d') === $today)
                    ->count(),
                'firstVisitAt' => TbilisiClock::iso($mine->first()?->started_at),
                'lastVisitAt' => TbilisiClock::iso($mine->last()?->started_at),
            ];
        })->values()->all();

        $totals = [
            'reps' => count($team),
            'planned' => array_sum($planned),
            'visited' => $visits->filter(fn (ErpVisit $visit) => $visit->status !== ErpVisit::STATUS_OPEN)
                ->map(fn (ErpVisit $visit) => $visit->user_id.':'.$visit->customer_id)
                ->unique()->count(),
            'openVisits' => $visits->where('status', ErpVisit::STATUS_OPEN)->count(),
            'missedVisits' => $visits->where('status', ErpVisit::STATUS_MISSED)->count(),
            'openTasks' => $tasks->where('status', ErpTask::STATUS_OPEN)->count(),
            'doneTasks' => $tasks->where('status', ErpTask::STATUS_DONE)->whereNull('checked_at')->count(),
            'checkedTasks' => $tasks->whereNotNull('checked_at')->count(),
            'overdueTasks' => $tasks->where('status', ErpTask::STATUS_OPEN)
                ->filter(fn (ErpTask $task) => $task->due_on !== null
                    && $task->due_on->toDateString() < $today)
                ->count(),
            'unreviewedPhotos' => $photos->whereNull('reviewed_at')->count(),
            'photosToday' => $photos
                ->filter(fn (ErpVisitPhoto $photo) => $photo->taken_at?->format('Y-m-d') === $today)
                ->count(),
            'surveyCount' => $surveys->count(),
            'shelfStocked' => $surveys->where('shelf_stocked', true)->count(),
            'priceVisible' => $surveys->where('price_visible', true)->count(),
            'promoPresent' => $surveys->where('promo_present', true)->count(),
            'competitorSeen' => $surveys->where('competitor_seen', true)->count(),
            'promoPlanned' => $promos->where('status', ErpPromoPlan::PLANNED)->count(),
            'promoActive' => $promos->where('status', ErpPromoPlan::ACTIVE)->count(),
            'promoDone' => $promos->where('status', ErpPromoPlan::DONE)->count(),
        ];

        return [
            'role' => $role->value,
            'date' => $now->toDateString(),
            'team' => $team,
            'totals' => $totals,
            'trend' => $this->trend($ids, $now),
            'me' => $role === UserRole::SalesRep ? $this->salesSnapshot($actor, $visits, $tasks, $photos, $planned, $today) : null,
        ];
    }

    /**
     * @return Collection<int, User>
     */
    private function teamMembers(User $actor): Collection
    {
        $ids = TeamAccess::salesUserIds($actor);
        $query = User::query()->where('role', UserRole::SalesRep)->whereNotNull('id_gvari');
        if ($ids !== null) {
            $query->whereIn('id', $ids === [] ? [-1] : $ids);
        }

        return $query->orderBy('name')->get();
    }

    private function plannedToday(User $member): int
    {
        if ($member->id_gvari === null) {
            return 0;
        }

        try {
            $page = $this->erp->customers()->listForPreseller((int) $member->id_gvari, null, null, 1, 'today');
        } catch (\Throwable) {
            return 0;
        }

        return (int) ($page->todayTotal ?? 0);
    }

    /**
     * @param  list<int>  $ids
     * @return list<array{date: string, visits: int, customers: int}>
     */
    private function trend(array $ids, Carbon $now): array
    {
        $from = $now->copy()->subDays(self::TREND_DAYS - 1)->startOfDay();
        $rows = ErpVisit::query()
            ->whereIn('user_id', $ids === [] ? [-1] : $ids)
            ->where('started_at', '>=', $from)
            ->where('status', '!=', ErpVisit::STATUS_OPEN)
            ->get(['customer_id', 'started_at']);

        $trend = [];
        for ($offset = self::TREND_DAYS - 1; $offset >= 0; $offset -= 1) {
            $day = $now->copy()->subDays($offset);
            $key = $day->toDateString();
            $ofDay = $rows->filter(fn (ErpVisit $visit) => $visit->started_at?->format('Y-m-d') === $key);
            $trend[] = [
                'date' => $key,
                'visits' => $ofDay->count(),
                'customers' => $ofDay->pluck('customer_id')->unique()->count(),
            ];
        }

        return $trend;
    }

    /**
     * @param  Collection<int, ErpVisit>  $visits
     * @param  Collection<int, ErpTask>  $tasks
     * @param  Collection<int, ErpVisitPhoto>  $photos
     * @param  array<int, int>  $planned
     * @return array<string, mixed>
     */
    private function salesSnapshot(
        User $actor,
        Collection $visits,
        Collection $tasks,
        Collection $photos,
        array $planned,
        string $today,
    ): array {
        $mine = $visits->where('user_id', (int) $actor->id);
        $finished = $mine->filter(fn (ErpVisit $visit) => $visit->status !== ErpVisit::STATUS_OPEN);
        $coaching = ErpVisitCoaching::query()
            ->where('user_id', $actor->id)
            ->with('supervisor')
            ->orderByDesc('id')
            ->first();
        $savedOrders = ErpSavedOrder::query()->where('user_id', $actor->id)->count();
        $openVisit = $mine->firstWhere('status', ErpVisit::STATUS_OPEN);

        return [
            'planned' => $planned[(int) $actor->id] ?? 0,
            'visited' => $finished->pluck('customer_id')->unique()->count(),
            'openTasks' => $tasks->where('user_id', (int) $actor->id)->where('status', ErpTask::STATUS_OPEN)
                ->sortBy('due_on')
                ->take(5)
                ->map(fn (ErpTask $task) => $task->toApiArray())
                ->values()
                ->all(),
            'openTaskCount' => $tasks->where('user_id', (int) $actor->id)->where('status', ErpTask::STATUS_OPEN)->count(),
            'photosToday' => $photos->where('user_id', (int) $actor->id)
                ->filter(fn (ErpVisitPhoto $photo) => $photo->taken_at?->format('Y-m-d') === $today)
                ->sortByDesc('id')
                ->take(8)
                ->map(fn (ErpVisitPhoto $photo) => [
                    'id' => $photo->id,
                    'phase' => (string) $photo->phase,
                    'customerName' => $photo->customer_name,
                    'takenAt' => TbilisiClock::iso($photo->taken_at),
                ])
                ->values()
                ->all(),
            'savedOrders' => $savedOrders,
            'openVisit' => $openVisit?->toApiArray(),
            'coaching' => $coaching ? [
                'rating' => (int) $coaching->rating,
                'note' => $coaching->note,
                'supervisorName' => $coaching->supervisor?->name,
            ] : null,
            'firstVisitAt' => TbilisiClock::iso($mine->first()?->started_at),
            'lastVisitAt' => TbilisiClock::iso($mine->last()?->started_at),
            'nextStop' => $this->nextStop($actor, $finished->pluck('customer_id')->map(fn ($id) => (string) $id)->all()),
        ];
    }

    /**
     * First customer of today's FMG route that has no finished visit yet.
     *
     * @param  list<string>  $visitedIds
     * @return array<string, mixed>|null
     */
    private function nextStop(User $actor, array $visitedIds): ?array
    {
        if ($actor->id_gvari === null) {
            return null;
        }

        try {
            $page = $this->erp->customers()->listForPreseller((int) $actor->id_gvari, null, null, 500, 'today');
        } catch (\Throwable) {
            return null;
        }

        foreach ($page->items as $customer) {
            $id = (string) $customer->customerId;
            if (in_array($id, $visitedIds, true)) {
                continue;
            }

            return [
                'customerId' => $id,
                'name' => $customer->name,
                'address' => $customer->address,
                'city' => $customer->city,
                'latitude' => $customer->latitude,
                'longitude' => $customer->longitude,
            ];
        }

        return null;
    }
}
