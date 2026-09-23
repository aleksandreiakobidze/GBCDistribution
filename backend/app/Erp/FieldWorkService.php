<?php

namespace App\Erp;

use App\Enums\UserRole;
use App\Erp\Contracts\ErpProvider;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\TbilisiClock;
use App\Erp\Support\TeamAccess;
use App\Models\ErpPromoPlan;
use App\Models\ErpShelfAudit;
use App\Models\ErpShelfAuditLine;
use App\Models\ErpTask;
use App\Models\ErpVisit;
use App\Models\ErpVisitCoaching;
use App\Models\ErpVisitPhoto;
use App\Models\ErpVisitSurvey;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

final class FieldWorkService
{
    public function __construct(private readonly ErpProvider $erp) {}

    /**
     * @param  array{salesUserId: int, customerId?: string|null, photoId?: int|null, title: string, note?: string|null, dueOn?: string|null}  $input
     * @return array<string, mixed>
     */
    public function createTask(User $actor, array $input): array
    {
        TeamAccess::assertSupervisor($actor);
        $sales = TeamAccess::assertSales($actor, (int) $input['salesUserId']);
        $customerId = $this->blank($input['customerId'] ?? null);
        $customerName = null;
        if ($customerId !== null) {
            $customerName = $this->erp->customers()->getAuthorized((int) $sales->id_gvari, $customerId)->name;
        }
        $photoId = isset($input['photoId']) ? (int) $input['photoId'] : null;
        if ($photoId) {
            $this->ownPhoto($sales, $photoId, $customerId);
        }

        $row = ErpTask::query()->create([
            'created_by' => $actor->id,
            'user_id' => $sales->id,
            'id_gvari' => (int) $sales->id_gvari,
            'customer_id' => $customerId,
            'customer_name' => $customerName,
            'photo_id' => $photoId ?: null,
            'title' => trim((string) $input['title']),
            'note' => $this->blank($input['note'] ?? null),
            'due_on' => $this->blank($input['dueOn'] ?? null),
            'status' => ErpTask::STATUS_OPEN,
        ]);

        return $row->fresh(['assignee', 'checker'])->toApiArray();
    }

    /**
     * @param  list<string>  $statuses
     * @param  list<int>  $salesUserIds
     * @return list<array<string, mixed>>
     */
    public function listTasks(User $actor, ?string $customerId, array $statuses = [], array $salesUserIds = []): array
    {
        $query = TeamAccess::scopeSales(ErpTask::query(), $actor)->with(['assignee', 'checker']);
        if ($customerId) {
            $query->where('customer_id', $customerId);
        }
        if ($statuses !== []) {
            $query->whereIn('status', $statuses);
        }
        $this->limitToSales($query, $actor, $salesUserIds);

        return $query->orderByDesc('id')->limit(200)->get()
            ->map(fn (ErpTask $row) => $row->toApiArray())
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function updateTask(User $actor, int $id, string $action): array
    {
        $row = TeamAccess::scopeSales(ErpTask::query(), $actor)->whereKey($id)->first();
        if (! $row) {
            throw new ErpException('TASK_NOT_FOUND', 'დავალება ვერ მოიძებნა.', 404);
        }

        if ($action === 'complete') {
            if (TeamAccess::role($actor) !== UserRole::SalesRep || (int) $row->user_id !== (int) $actor->id) {
                TeamAccess::deny();
            }
            if ($row->status !== ErpTask::STATUS_DONE) {
                $row->update([
                    'status' => ErpTask::STATUS_DONE,
                    'completed_at' => Carbon::now('Asia/Tbilisi'),
                ]);
            }
        } elseif ($action === 'check') {
            TeamAccess::assertSupervisor($actor);
            if ($row->status !== ErpTask::STATUS_DONE) {
                throw new ErpException('TASK_NOT_DONE', 'ჯერ სეილსმა უნდა შეასრულოს დავალება.', 422);
            }
            $row->update([
                'checked_by' => $actor->id,
                'checked_at' => Carbon::now('Asia/Tbilisi'),
            ]);
        } else {
            throw new ErpException('INVALID_ACTION', 'მოქმედება არასწორია.', 422);
        }

        return $row->fresh(['assignee', 'checker'])->toApiArray();
    }

    /**
     * @param  array{visitId: int, shelfStocked: bool, priceVisible: bool, promoPresent: bool, competitorSeen: bool}  $input
     * @return array<string, mixed>
     */
    public function saveSurvey(User $actor, array $input): array
    {
        if (TeamAccess::role($actor) !== UserRole::SalesRep) {
            TeamAccess::deny();
        }
        $visit = $this->surveyVisit($actor, (int) $input['visitId']);
        $row = ErpVisitSurvey::query()->updateOrCreate(
            ['visit_id' => $visit->id],
            [
                'user_id' => $actor->id,
                'id_gvari' => (int) $actor->id_gvari,
                'customer_id' => $visit->customer_id,
                'customer_name' => $visit->customer_name,
                'shelf_stocked' => (bool) $input['shelfStocked'],
                'price_visible' => (bool) $input['priceVisible'],
                'promo_present' => (bool) $input['promoPresent'],
                'competitor_seen' => (bool) $input['competitorSeen'],
            ],
        );

        return $row->fresh('user')->toApiArray();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listSurveys(User $actor, ?string $customerId): array
    {
        $query = TeamAccess::scopeSales(ErpVisitSurvey::query(), $actor)->with('user');
        if ($customerId) {
            $query->where('customer_id', $customerId);
        }

        return $query->orderByDesc('id')->limit(20)->get()
            ->map(fn (ErpVisitSurvey $row) => $row->toApiArray())
            ->all();
    }

    /**
     * @param  array{visitId: int, rating: int, note?: string|null}  $input
     * @return array<string, mixed>
     */
    public function saveCoaching(User $actor, array $input): array
    {
        TeamAccess::assertSupervisor($actor);
        $visit = TeamAccess::scopeSales(ErpVisit::query(), $actor)->whereKey((int) $input['visitId'])->first();
        if (! $visit) {
            throw new ErpException('VISIT_NOT_FOUND', 'ვიზიტი ვერ მოიძებნა.', 404);
        }
        $row = ErpVisitCoaching::query()->updateOrCreate(
            ['visit_id' => $visit->id],
            [
                'user_id' => $visit->user_id,
                'supervisor_id' => $actor->id,
                'rating' => (int) $input['rating'],
                'note' => $this->blank($input['note'] ?? null),
            ],
        );

        return $row->fresh(['sales', 'supervisor', 'visit'])->toApiArray();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listCoaching(User $actor, ?string $customerId): array
    {
        $query = TeamAccess::scopeSales(ErpVisitCoaching::query(), $actor)->with(['sales', 'supervisor', 'visit']);
        if ($customerId) {
            $query->whereHas('visit', fn (Builder $inner) => $inner->where('customer_id', $customerId));
        }

        return $query->orderByDesc('id')->limit(20)->get()
            ->map(fn (ErpVisitCoaching $row) => $row->toApiArray())
            ->all();
    }

    /**
     * @param  array{customerId: string, photoId?: int|null, lines: list<array{itemId: string, status: string}>}  $input
     * @return array<string, mixed>
     */
    public function saveShelf(User $actor, array $input): array
    {
        if (TeamAccess::role($actor) !== UserRole::SalesRep) {
            TeamAccess::deny();
        }
        $customerId = (string) $input['customerId'];
        $customer = $this->erp->customers()->getAuthorized((int) $actor->id_gvari, $customerId);
        $photoId = isset($input['photoId']) ? (int) $input['photoId'] : null;
        $visitId = null;
        if ($photoId) {
            $photo = $this->ownPhoto($actor, $photoId, $customerId);
            if ($photo->phase !== ErpVisitPhoto::PHASE_SHELF) {
                throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
            }
            $visitId = $photo->visit_id;
        }

        $audit = ErpShelfAudit::query()->create([
            'user_id' => $actor->id,
            'id_gvari' => (int) $actor->id_gvari,
            'customer_id' => $customerId,
            'customer_name' => $customer->name,
            'visit_id' => $visitId,
            'photo_id' => $photoId ?: null,
        ]);

        foreach ($input['lines'] as $line) {
            $item = $this->erp->products()->getForCustomer((int) $actor->id_gvari, $customer, (string) $line['itemId']);
            ErpShelfAuditLine::query()->create([
                'audit_id' => $audit->id,
                'item_id' => $item->itemId,
                'item_name' => $item->name,
                'status' => (string) $line['status'],
            ]);
        }

        return $audit->fresh(['user', 'lines'])->toApiArray();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listShelf(User $actor, ?string $customerId): array
    {
        $query = TeamAccess::scopeSales(ErpShelfAudit::query(), $actor)->with(['user', 'lines']);
        if ($customerId) {
            $query->where('customer_id', $customerId);
        }

        return $query->orderByDesc('id')->limit(20)->get()
            ->map(fn (ErpShelfAudit $row) => $row->toApiArray())
            ->all();
    }

    /**
     * @param  array{salesUserId: int, customerId?: string|null, title: string, startsOn: string, endsOn: string, note?: string|null}  $input
     * @return array<string, mixed>
     */
    public function createPromo(User $actor, array $input): array
    {
        TeamAccess::assertSupervisor($actor);
        $sales = TeamAccess::assertSales($actor, (int) $input['salesUserId']);
        $this->assertRange((string) $input['startsOn'], (string) $input['endsOn']);
        $customerId = $this->blank($input['customerId'] ?? null);
        $customerName = $customerId
            ? $this->erp->customers()->getAuthorized((int) $sales->id_gvari, $customerId)->name
            : null;

        $row = ErpPromoPlan::query()->create([
            'created_by' => $actor->id,
            'user_id' => $sales->id,
            'id_gvari' => (int) $sales->id_gvari,
            'customer_id' => $customerId,
            'customer_name' => $customerName,
            'title' => trim((string) $input['title']),
            'starts_on' => $input['startsOn'],
            'ends_on' => $input['endsOn'],
            'status' => ErpPromoPlan::PLANNED,
            'note' => $this->blank($input['note'] ?? null),
        ]);

        return $row->fresh('assignee')->toApiArray();
    }

    /**
     * @param  list<int>  $salesUserIds
     * @return list<array<string, mixed>>
     */
    public function listPromos(User $actor, ?string $from, ?string $to, array $salesUserIds = [], array $statuses = []): array
    {
        $query = TeamAccess::scopeSales(ErpPromoPlan::query(), $actor)->with('assignee');
        if ($from && $to) {
            $query->whereDate('starts_on', '<=', $to)->whereDate('ends_on', '>=', $from);
        }
        if ($statuses !== []) {
            $query->whereIn('status', $statuses);
        }
        $this->limitToSales($query, $actor, $salesUserIds);

        return $query->orderBy('starts_on')->orderBy('id')->limit(200)->get()
            ->map(fn (ErpPromoPlan $row) => $row->toApiArray())
            ->all();
    }

    /**
     * @param  array{title?: string, startsOn?: string, endsOn?: string, status?: string, customerId?: string|null, note?: string|null, photoId?: int|null}  $input
     * @return array<string, mixed>
     */
    public function updatePromo(User $actor, int $id, array $input): array
    {
        TeamAccess::assertSupervisor($actor);
        $row = TeamAccess::scopeSales(ErpPromoPlan::query(), $actor)->whereKey($id)->first();
        if (! $row) {
            throw new ErpException('PROMO_NOT_FOUND', 'აქცია ვერ მოიძებნა.', 404);
        }
        $sales = TeamAccess::assertSales($actor, (int) $row->user_id);
        $starts = (string) ($input['startsOn'] ?? $row->starts_on?->toDateString());
        $ends = (string) ($input['endsOn'] ?? $row->ends_on?->toDateString());
        $this->assertRange($starts, $ends);
        $status = (string) ($input['status'] ?? $row->status);
        $customerId = array_key_exists('customerId', $input) ? $this->blank($input['customerId']) : $row->customer_id;
        $customerName = $row->customer_name;
        if ($customerId !== $row->customer_id) {
            $customerName = $customerId
                ? $this->erp->customers()->getAuthorized((int) $sales->id_gvari, $customerId)->name
                : null;
        }
        $photoId = array_key_exists('photoId', $input) ? ($input['photoId'] ? (int) $input['photoId'] : null) : $row->photo_id;
        if ($status === ErpPromoPlan::DONE) {
            if (! $photoId) {
                throw new ErpException('PHOTO_REQUIRED', 'შესრულებულ აქციას ფოტო სჭირდება.', 422);
            }
            $this->ownPhoto($sales, (int) $photoId, $customerId);
        } else {
            $photoId = null;
        }

        $row->update([
            'title' => trim((string) ($input['title'] ?? $row->title)),
            'starts_on' => $starts,
            'ends_on' => $ends,
            'status' => $status,
            'customer_id' => $customerId,
            'customer_name' => $customerName,
            'note' => array_key_exists('note', $input) ? $this->blank($input['note']) : $row->note,
            'photo_id' => $photoId,
        ]);

        return $row->fresh('assignee')->toApiArray();
    }

    /**
     * @return array<string, mixed>
     */
    public function copyPromo(User $actor, int $id): array
    {
        TeamAccess::assertSupervisor($actor);
        $row = TeamAccess::scopeSales(ErpPromoPlan::query(), $actor)->whereKey($id)->first();
        if (! $row) {
            throw new ErpException('PROMO_NOT_FOUND', 'აქცია ვერ მოიძებნა.', 404);
        }
        $copy = $row->replicate(['photo_id', 'status']);
        $copy->status = ErpPromoPlan::PLANNED;
        $copy->photo_id = null;
        $copy->created_by = $actor->id;
        $copy->save();

        return $copy->fresh('assignee')->toApiArray();
    }

    /**
     * @param  list<int>  $salesUserIds
     * @return array<string, mixed>
     */
    public function day(User $actor, array $salesUserIds = []): array
    {
        [$start, $end, $day] = $this->todayBounds();
        $visitQuery = TeamAccess::scopeSales(ErpVisit::query()->with('user'), $actor);
        $this->limitToSales($visitQuery, $actor, $salesUserIds);
        $visits = $visitQuery
            ->whereBetween('started_at', [$start, $end])
            ->orderBy('started_at')
            ->get();
        $finishedCustomers = $visits
            ->filter(fn (ErpVisit $visit) => $visit->status !== ErpVisit::STATUS_OPEN)
            ->map(fn (ErpVisit $visit) => $visit->user_id.':'.$visit->customer_id)
            ->unique()
            ->values();
        $salesIds = $salesUserIds !== []
            ? $salesUserIds
            : (TeamAccess::salesUserIds($actor) ?? User::query()->where('role', UserRole::SalesRep)->whereNotNull('id_gvari')->pluck('id')->map(fn ($id) => (int) $id)->all());
        $planned = 0;
        foreach (User::query()->whereIn('id', $salesIds === [] ? [-1] : $salesIds)->get() as $sales) {
            if ($sales->id_gvari === null) {
                continue;
            }
            $page = $this->erp->customers()->listForPreseller((int) $sales->id_gvari, null, null, 1, 'today');
            $planned += (int) ($page->todayTotal ?? 0);
        }
        $doneQuery = TeamAccess::scopeSales(ErpTask::query(), $actor);
        $this->limitToSales($doneQuery, $actor, $salesUserIds);
        $doneTasks = $doneQuery
            ->where('status', ErpTask::STATUS_DONE)
            ->whereBetween('completed_at', [$start, $end])
            ->count();
        $openQuery = TeamAccess::scopeSales(ErpTask::query(), $actor);
        $this->limitToSales($openQuery, $actor, $salesUserIds);
        $openToday = $openQuery
            ->where('status', ErpTask::STATUS_OPEN)
            ->whereDate('due_on', $day)
            ->count();

        return [
            'coverageVisited' => $finishedCustomers->count(),
            'coveragePlanned' => $planned,
            'tasksDone' => $doneTasks,
            'tasksTotal' => $doneTasks + $openToday,
            'firstVisitAt' => TbilisiClock::iso($visits->first()?->started_at),
            'lastVisitAt' => TbilisiClock::iso($visits->last()?->started_at),
            'visits' => $visits->map(fn (ErpVisit $visit) => [
                ...$visit->toApiArray(),
                'salesName' => $visit->user?->name,
            ])->values()->all(),
        ];
    }

    /**
     * Narrows a team-scoped query to the picked sales reps after checking every one of them.
     *
     * @param  Builder<Model>  $query
     * @param  list<int>  $salesUserIds
     */
    private function limitToSales(Builder $query, User $actor, array $salesUserIds): void
    {
        if ($salesUserIds === []) {
            return;
        }
        foreach ($salesUserIds as $salesUserId) {
            TeamAccess::assertSales($actor, (int) $salesUserId);
        }
        $query->whereIn('user_id', $salesUserIds);
    }

    private function surveyVisit(User $sales, int $visitId): ErpVisit
    {
        $visit = ErpVisit::query()->where('user_id', $sales->id)->whereKey($visitId)->first();
        if (! $visit) {
            throw new ErpException('VISIT_NOT_FOUND', 'ვიზიტი ვერ მოიძებნა.', 404);
        }
        $startedDay = $visit->started_at?->format('Y-m-d');
        $today = Carbon::now('Asia/Tbilisi')->toDateString();
        if ($visit->status !== ErpVisit::STATUS_OPEN && $startedDay !== $today) {
            throw new ErpException('VISIT_REQUIRED', 'ანკეტა ამ კლიენტის დღევანდელ ვიზიტს სჭირდება.', 422);
        }

        return $visit;
    }

    private function ownPhoto(User $sales, int $photoId, ?string $customerId): ErpVisitPhoto
    {
        $photo = ErpVisitPhoto::query()->where('user_id', $sales->id)->whereKey($photoId)->first();
        if (! $photo || ($customerId !== null && (string) $photo->customer_id !== $customerId)) {
            throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
        }

        return $photo;
    }

    private function assertRange(string $starts, string $ends): void
    {
        if ($ends < $starts) {
            throw new ErpException('INVALID_RANGE', 'დასასრული დასაწყისზე ადრეა.', 422);
        }
    }

    /**
     * @return array{0: string, 1: string, 2: string}
     */
    private function todayBounds(): array
    {
        $now = Carbon::now('Asia/Tbilisi');

        return [
            $now->copy()->startOfDay()->format('Y-m-d H:i:s'),
            $now->copy()->endOfDay()->format('Y-m-d H:i:s'),
            $now->toDateString(),
        ];
    }

    private function blank(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : $text;
    }
}
