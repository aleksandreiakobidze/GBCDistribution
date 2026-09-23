<?php

namespace App\Erp;

use App\Enums\UserRole;
use App\Erp\Support\TeamAccess;
use App\Erp\Support\TbilisiClock;
use App\Models\ErpCollection;
use App\Models\ErpProductReturn;
use App\Models\ErpPromoPlan;
use App\Models\ErpSavedOrder;
use App\Models\ErpShelfAudit;
use App\Models\ErpShelfAuditLine;
use App\Models\ErpTask;
use App\Models\ErpVisit;
use App\Models\ErpVisitCoaching;
use App\Models\ErpVisitPhoto;
use App\Models\ErpVisitSurvey;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

final class PresellerReportService
{
    /**
     * Aggregates one sales rep's own field work for today, or 7, 30, or 90 Tbilisi days.
     *
     * @return array<string, mixed>
     */
    public function forSalesRep(User $actor, int $days): array
    {
        if (TeamAccess::role($actor) !== UserRole::SalesRep) {
            TeamAccess::deny();
        }

        $days = in_array($days, [1, 7, 30, 90], true) ? $days : 7;
        $now = Carbon::now('Asia/Tbilisi');
        $start = $now->copy()->subDays($days - 1)->startOfDay();
        $end = $now->copy()->endOfDay();
        $today = $now->toDateString();
        $userId = (int) $actor->id;

        $visits = ErpVisit::query()
            ->where('user_id', $userId)
            ->whereBetween('started_at', [$start, $end])
            ->orderBy('started_at')
            ->get();

        $finished = $visits->filter(fn (ErpVisit $visit) => $visit->status !== ErpVisit::STATUS_OPEN)->values();

        $surveys = ErpVisitSurvey::query()
            ->where('user_id', $userId)
            ->whereIn('visit_id', $visits->pluck('id')->all() ?: [-1])
            ->get();

        $tasks = ErpTask::query()->where('user_id', $userId)->get();

        $photos = ErpVisitPhoto::query()
            ->where('user_id', $userId)
            ->whereBetween('taken_at', [$start, $end])
            ->get(['phase', 'taken_at']);

        $audits = ErpShelfAudit::query()
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$start, $end])
            ->get(['id']);

        $promos = ErpPromoPlan::query()
            ->where('user_id', $userId)
            ->whereDate('starts_on', '<=', $end->toDateString())
            ->whereDate('ends_on', '>=', $start->toDateString())
            ->get(['status']);

        $collections = ErpCollection::query()
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$start, $end])
            ->get(['amount', 'created_at']);

        $returns = ErpProductReturn::query()
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$start, $end])
            ->count();

        $saved = ErpSavedOrder::query()
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$start, $end])
            ->get(['total']);

        $coaching = ErpVisitCoaching::query()
            ->with('supervisor')
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$start, $end])
            ->orderByDesc('id')
            ->get();

        $durations = $finished
            ->filter(fn (ErpVisit $visit) => $visit->started_at !== null && $visit->ended_at !== null)
            ->map(fn (ErpVisit $visit) => $visit->started_at->diffInMinutes($visit->ended_at));

        $last = $finished->sortBy(fn (ErpVisit $visit) => $visit->ended_at ?? $visit->started_at)->last();

        return [
            'days' => $days,
            'from' => $start->toDateString(),
            'to' => $end->toDateString(),
            'visits' => [
                'finished' => $finished->count(),
                'averageMinutes' => $durations->isEmpty() ? null : (int) round($durations->avg()),
                'firstAt' => TbilisiClock::iso($finished->first()?->started_at),
                'lastAt' => TbilisiClock::iso($last?->ended_at ?? $last?->started_at),
                'byDay' => $this->visitDays($finished, $now, $days),
            ],
            'survey' => [
                'count' => $surveys->count(),
                'shelfStocked' => $surveys->where('shelf_stocked', true)->count(),
                'priceVisible' => $surveys->where('price_visible', true)->count(),
                'promoPresent' => $surveys->where('promo_present', true)->count(),
                'competitorSeen' => $surveys->where('competitor_seen', true)->count(),
            ],
            'tasks' => [
                'open' => $tasks->where('status', ErpTask::STATUS_OPEN)->count(),
                'done' => $tasks->where('status', ErpTask::STATUS_DONE)->whereNull('checked_at')
                    ->filter(fn (ErpTask $task) => $this->inWindow($task->completed_at, $start, $end))
                    ->count(),
                'checked' => $tasks->filter(fn (ErpTask $task) => $this->inWindow($task->checked_at, $start, $end))->count(),
                'overdue' => $tasks->where('status', ErpTask::STATUS_OPEN)
                    ->filter(fn (ErpTask $task) => $task->due_on !== null && $task->due_on->toDateString() < $today)
                    ->count(),
            ],
            'photos' => [
                'before' => $photos->where('phase', ErpVisitPhoto::PHASE_BEFORE)->count(),
                'survey' => $photos->where('phase', ErpVisitPhoto::PHASE_SURVEY)->count(),
                'shelf' => $photos->where('phase', ErpVisitPhoto::PHASE_SHELF)->count(),
                'end' => $photos->where('phase', ErpVisitPhoto::PHASE_END)->count(),
            ],
            'shelf' => [
                'audits' => $audits->count(),
                'lines' => $audits->isEmpty()
                    ? 0
                    : ErpShelfAuditLine::query()->whereIn('audit_id', $audits->pluck('id')->all())->count(),
            ],
            'promos' => [
                'planned' => $promos->where('status', ErpPromoPlan::PLANNED)->count(),
                'active' => $promos->where('status', ErpPromoPlan::ACTIVE)->count(),
                'done' => $promos->where('status', ErpPromoPlan::DONE)->count(),
            ],
            'money' => [
                'collected' => round((float) $collections->sum('amount'), 2),
                'collectionsByDay' => $this->collectionDays($collections, $now, $days),
                'returns' => $returns,
                'savedOrders' => $saved->count(),
                'savedOrdersTotal' => round((float) $saved->sum('total'), 2),
            ],
            'customers' => $this->topCustomers($finished),
            'coaching' => [
                'count' => $coaching->count(),
                'averageRating' => $coaching->isEmpty() ? null : round((float) $coaching->avg('rating'), 1),
                'note' => $coaching->first()?->note,
                'supervisorName' => $coaching->first()?->supervisor?->name,
            ],
        ];
    }

    /**
     * @param  Collection<int, ErpVisit>  $finished
     * @return list<array{date: string, visits: int}>
     */
    private function visitDays(Collection $finished, Carbon $now, int $days): array
    {
        $points = [];
        for ($offset = $days - 1; $offset >= 0; $offset -= 1) {
            $key = $now->copy()->subDays($offset)->toDateString();
            $points[] = [
                'date' => $key,
                'visits' => $finished->filter(fn (ErpVisit $visit) => $visit->started_at?->format('Y-m-d') === $key)->count(),
            ];
        }

        return $points;
    }

    /**
     * @param  Collection<int, ErpCollection>  $collections
     * @return list<array{date: string, amount: float}>
     */
    private function collectionDays(Collection $collections, Carbon $now, int $days): array
    {
        $points = [];
        for ($offset = $days - 1; $offset >= 0; $offset -= 1) {
            $key = $now->copy()->subDays($offset)->toDateString();
            $amount = $collections
                ->filter(fn (ErpCollection $row) => $row->created_at?->timezone('Asia/Tbilisi')->toDateString() === $key)
                ->sum('amount');
            $points[] = ['date' => $key, 'amount' => round((float) $amount, 2)];
        }

        return $points;
    }

    /**
     * @param  Collection<int, ErpVisit>  $finished
     * @return list<array{customerId: string, customerName: string|null, visits: int}>
     */
    private function topCustomers(Collection $finished): array
    {
        return $finished
            ->groupBy('customer_id')
            ->map(function (Collection $rows, mixed $customerId) {
                return [
                    'customerId' => (string) $customerId,
                    'customerName' => $rows->first()?->customer_name,
                    'visits' => $rows->count(),
                ];
            })
            ->sortByDesc('visits')
            ->take(5)
            ->values()
            ->all();
    }

    private function inWindow(mixed $value, Carbon $start, Carbon $end): bool
    {
        if ($value === null) {
            return false;
        }

        $moment = $value instanceof Carbon ? $value : Carbon::parse($value);

        return $moment->between($start, $end);
    }
}
