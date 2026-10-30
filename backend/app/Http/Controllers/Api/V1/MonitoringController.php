<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Erp\Exceptions\ErpException;
use App\Erp\Monitoring\KegDebt;
use App\Erp\Support\TeamAccess;
use App\Models\MonitoringOrder;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class MonitoringController extends V1Controller
{
    public function __construct(private readonly KegDebt $debts)
    {
    }

    public function reps(Request $request): JsonResponse
    {
        $ids = $this->visibleSalesIds($this->user($request));
        $query = User::query()
            ->where('role', UserRole::SalesRep)
            ->whereNotNull('id_gvari')
            ->where('is_active', true)
            ->orderBy('name');
        if ($ids !== null) {
            $query->whereIn('id', $ids === [] ? [-1] : $ids);
        }

        $reps = $query->get(['id', 'name', 'id_gvari'])->map(fn (User $rep) => [
            'id' => (int) $rep->id,
            'name' => (string) $rep->name,
            'presellerId' => (string) $rep->id_gvari,
        ])->values();

        return $this->ok($reps);
    }

    public function orgs(Request $request): JsonResponse
    {
        $actor = $this->user($request);
        $target = $this->visibleRep($actor, $this->userId($request));
        $orgs = $this->debts->forPreseller((int) $target->id_gvari);
        $places = $this->debts->places(array_column($orgs, 'idOrg'));
        $latest = MonitoringOrder::query()
            ->whereIn('user_id', $this->orderOwnerIds($actor))
            ->where('sales_user_id', $target->id)
            ->selectRaw('id_org, MAX(created_at) as last_at')
            ->groupBy('id_org')
            ->pluck('last_at', 'id_org');

        foreach ($orgs as &$org) {
            $place = $places[$org['idOrg']] ?? ['address' => '', 'latitude' => null, 'longitude' => null];
            $org['address'] = $place['address'];
            $org['latitude'] = $place['latitude'];
            $org['longitude'] = $place['longitude'];
            $last = $latest[$org['idOrg']] ?? null;
            $org['lastOrderAt'] = $last !== null ? Carbon::parse($last)->toIso8601String() : null;
        }
        unset($org);

        return $this->ok($orgs);
    }

    public function card(Request $request): JsonResponse
    {
        $idOrg = trim((string) $request->query('idOrg', ''));
        if ($idOrg === '') {
            throw new ErpException('INVALID_ORG', 'ორგანიზაცია არ არის არჩეული.', 422);
        }

        $target = $this->visibleRep($this->user($request), $this->userId($request));
        $card = $this->debts->card($idOrg, [(int) $target->id_gvari]);
        if ($card === null) {
            throw new ErpException('ORG_NOT_FOUND', 'ორგანიზაცია ვერ მოიძებნა.', 404);
        }

        return $this->ok($card);
    }

    public function orders(Request $request): JsonResponse
    {
        $orders = MonitoringOrder::query()
            ->with('user')
            ->whereIn('user_id', $this->orderOwnerIds($this->user($request)))
            ->orderByDesc('id')
            ->get();

        return $this->ok($orders->map(fn (MonitoringOrder $order) => $this->orderSummary($order))->values());
    }

    public function order(Request $request, int $id): JsonResponse
    {
        return $this->ok($this->orderDetail($this->ownOrder($request, $id)));
    }

    public function storeOrder(Request $request): JsonResponse
    {
        $actor = $this->user($request);
        $rawUserId = $request->input('userId');
        if (! is_scalar($rawUserId) || ! ctype_digit((string) $rawUserId) || (int) $rawUserId < 1) {
            throw new ErpException('INVALID_USER', 'სეილსმენი არ არის არჩეული.', 422);
        }
        $target = $this->visibleRep($actor, (int) $rawUserId);
        $idOrg = trim((string) $request->input('idOrg', ''));
        if ($idOrg === '') {
            throw new ErpException('INVALID_ORG', 'ორგანიზაცია არ არის არჩეული.', 422);
        }
        $actualDebt = $this->amount($request->input('actualDebt'));
        if ($actualDebt === null) {
            throw new ErpException('INVALID_DEBT', 'რეალური ვალი რიცხვი უნდა იყოს.', 422);
        }
        $card = $this->debts->card($idOrg, [(int) $target->id_gvari]);
        if ($card === null) {
            throw new ErpException('ORG_NOT_FOUND', 'ორგანიზაცია ვერ მოიძებნა.', 404);
        }

        $matched = $this->actualQuantities($request->input('lines', []));
        $systemLines = [];
        foreach ($card['stock'] as $line) {
            $key = $line['idProd']."\n".$line['name'];
            if (! array_key_exists($key, $matched)) {
                throw new ErpException('INVALID_QTY', 'ყველა ნაშთის ხაზს რეალური რაოდენობა სჭირდება.', 422);
            }
            $systemLines[] = [
                'source' => 'system',
                'id_prod' => $line['idProd'],
                'name' => $line['name'],
                'system_qty' => $line['qty'],
                'actual_qty' => $matched[$key],
            ];
            unset($matched[$key]);
        }
        if ($matched !== []) {
            throw new ErpException('INVALID_LINE', 'ნაშთის ხაზი ვერ მოიძებნა.', 422);
        }

        $order = DB::transaction(function () use ($actor, $target, $card, $actualDebt, $systemLines, $request) {
            $place = $this->debts->places([$card['idOrg']])[$card['idOrg']] ?? null;
            $order = MonitoringOrder::query()->create([
                'user_id' => $actor->id,
                'user_name' => mb_substr((string) $actor->name, 0, 255),
                'sales_user_id' => $target->id,
                'sales_name' => mb_substr((string) $target->name, 0, 255),
                'id_org' => $card['idOrg'],
                'org_name' => mb_substr((string) $card['name'], 0, 255),
                'legal_address' => mb_substr((string) ($place['address'] ?? ''), 0, 500),
                'system_debt' => $card['debt'],
                'actual_debt' => $actualDebt,
            ]);
            $sort = 0;
            foreach ([...$systemLines, ...$this->addedLines($request->input('added', []))] as $line) {
                $sort++;
                $order->lines()->create($line + ['sort_order' => $sort]);
            }

            return $order;
        });
        $order->load('lines');

        return $this->ok($this->orderDetail($order), 201);
    }

    private function userId(Request $request): int
    {
        $raw = $request->query('userId');
        if (! is_scalar($raw) || ! ctype_digit((string) $raw) || (int) $raw < 1) {
            throw new ErpException('INVALID_USER', 'სეილსმენი არ არის არჩეული.', 422);
        }

        return (int) $raw;
    }

    /**
     * @return list<int>|null
     */
    private function visibleSalesIds(User $actor): ?array
    {
        if ($this->seesEverySalesperson($actor)) {
            return null;
        }

        return TeamAccess::salesUserIds($actor);
    }

    private function visibleRep(User $actor, int $userId): User
    {
        $target = User::query()
            ->whereKey($userId)
            ->where('role', UserRole::SalesRep)
            ->whereNotNull('id_gvari')
            ->where('is_active', true)
            ->first();
        $ids = $this->visibleSalesIds($actor);
        if (! $target || ($ids !== null && ! in_array((int) $target->id, $ids, true))) {
            TeamAccess::deny();
        }

        return $target;
    }

    private function seesEverySalesperson(User $actor): bool
    {
        $name = $this->roleName($actor);

        return $name === 'monitoring' || $name === 'monitoring head';
    }

    private function isMonitoringHead(User $actor): bool
    {
        return $this->roleName($actor) === 'monitoring head';
    }

    private function roleName(User $actor): string
    {
        $role = $actor->role;
        $name = $role instanceof UserRole ? $role->value : (string) $role;

        return mb_strtolower(trim($name));
    }

    /**
     * @return list<int>
     */
    private function orderOwnerIds(User $actor): array
    {
        if (! $this->isMonitoringHead($actor)) {
            return [(int) $actor->id];
        }

        $ids = User::query()
            ->whereRaw('lower(trim(role)) = ?', ['monitoring'])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $ids[] = (int) $actor->id;

        return array_values(array_unique($ids));
    }

    private function ownOrder(Request $request, int $id): MonitoringOrder
    {
        $order = MonitoringOrder::query()
            ->with(['lines', 'user'])
            ->whereKey($id)
            ->whereIn('user_id', $this->orderOwnerIds($this->user($request)))
            ->first();
        if (! $order) {
            throw new ErpException('ORDER_NOT_FOUND', 'ორდერი ვერ მოიძებნა.', 404);
        }

        return $order;
    }

    private function saverName(MonitoringOrder $order): string
    {
        $stored = trim((string) $order->user_name);
        if ($stored !== '') {
            return $stored;
        }

        return trim((string) ($order->user?->name ?? ''));
    }

    /**
     * @return array{id: int, savedAt: string|null, orgName: string, idOrg: string, salesName: string, saverName: string, address: string, systemDebt: float, actualDebt: float}
     */
    private function orderSummary(MonitoringOrder $order): array
    {
        return [
            'id' => (int) $order->id,
            'savedAt' => $order->created_at?->toIso8601String(),
            'orgName' => (string) $order->org_name,
            'idOrg' => (string) $order->id_org,
            'salesName' => (string) $order->sales_name,
            'saverName' => $this->saverName($order),
            'address' => (string) $order->legal_address,
            'systemDebt' => (float) $order->system_debt,
            'actualDebt' => (float) $order->actual_debt,
        ];
    }

    /**
     * @return array{id: int, savedAt: string|null, orgName: string, idOrg: string, salesName: string, systemDebt: float, actualDebt: float, lines: list<array{source: string, idProd: string|null, name: string, systemQty: float|null, actualQty: float}>}
     */
    private function orderDetail(MonitoringOrder $order): array
    {
        return $this->orderSummary($order) + [
            'lines' => $order->lines->map(fn ($line) => [
                'source' => (string) $line->source,
                'idProd' => $line->id_prod !== null ? (string) $line->id_prod : null,
                'name' => (string) $line->name,
                'systemQty' => $line->system_qty !== null ? (float) $line->system_qty : null,
                'actualQty' => (float) $line->actual_qty,
            ])->values()->all(),
        ];
    }

    /**
     * @return array<string, float>
     */
    private function actualQuantities(mixed $rows): array
    {
        if (! is_array($rows)) {
            throw new ErpException('INVALID_LINE', 'ნაშთის ხაზები არასწორია.', 422);
        }
        $matched = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                throw new ErpException('INVALID_LINE', 'ნაშთის ხაზები არასწორია.', 422);
            }
            $key = trim((string) ($row['idProd'] ?? ''))."\n".trim((string) ($row['name'] ?? ''));
            $qty = $this->amount($row['actualQty'] ?? null);
            if ($key === "\n" || $qty === null || isset($matched[$key])) {
                throw new ErpException('INVALID_QTY', 'რეალური რაოდენობა რიცხვი უნდა იყოს.', 422);
            }
            $matched[$key] = $qty;
        }

        return $matched;
    }

    /**
     * @return list<array{source: string, id_prod: null, name: string, system_qty: null, actual_qty: float}>
     */
    private function addedLines(mixed $rows): array
    {
        if (! is_array($rows)) {
            throw new ErpException('INVALID_LINE', 'დამატებული ხაზები არასწორია.', 422);
        }
        $lines = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                throw new ErpException('INVALID_LINE', 'დამატებული ხაზები არასწორია.', 422);
            }
            $name = trim((string) ($row['name'] ?? ''));
            $qty = $this->amount($row['qty'] ?? null);
            if ($name === '' || $qty === null) {
                throw new ErpException('INVALID_LINE', 'დამატებულ ხაზს სახელი და რაოდენობა სჭირდება.', 422);
            }
            $lines[] = [
                'source' => 'added',
                'id_prod' => null,
                'name' => mb_substr($name, 0, 255),
                'system_qty' => null,
                'actual_qty' => $qty,
            ];
        }

        return $lines;
    }

    private function amount(mixed $value): ?float
    {
        if (is_string($value)) {
            $value = str_replace(',', '.', trim($value));
        }
        if (! is_int($value) && ! is_float($value) && ! (is_string($value) && is_numeric($value))) {
            return null;
        }
        $number = (float) $value;
        if (! is_finite($number)) {
            return null;
        }

        return round($number, 2);
    }
}
