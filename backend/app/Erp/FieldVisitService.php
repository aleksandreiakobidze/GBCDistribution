<?php

namespace App\Erp;

use App\Enums\UserRole;
use App\Erp\Contracts\ErpProvider;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\GeoPoint;
use App\Models\ErpVisit;
use App\Models\User;
use Carbon\Carbon;

final class FieldVisitService
{
    public function __construct(private readonly ErpProvider $erp)
    {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function list(int $ownerUserId, ?string $customerId, bool $todayOnly): array
    {
        $query = ErpVisit::query()->where('user_id', $ownerUserId);

        if ($customerId !== null && $customerId !== '') {
            $query->where('customer_id', $customerId);
        }

        if ($todayOnly) {
            $tz = 'Asia/Tbilisi';
            $query->whereBetween('started_at', [
                Carbon::now($tz)->startOfDay(),
                Carbon::now($tz)->endOfDay(),
            ]);
        }

        return $query
            ->orderByDesc('started_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (ErpVisit $row) => $row->toApiArray())
            ->values()
            ->all();
    }

    /**
     * @param  array{customerId: string, latitude?: string|null, longitude?: string|null}  $input
     * @return array<string, mixed>
     */
    public function start(User $actor, int $ownerUserId, int $idGvari, array $input): array
    {
        $this->assertSalesRep($actor);

        $customerId = (string) $input['customerId'];
        $customer = $this->erp->customers()->getAuthorized($idGvari, $customerId);
        [$latitude, $longitude] = $this->coords($input['latitude'] ?? null, $input['longitude'] ?? null);

        $open = ErpVisit::query()
            ->where('user_id', $ownerUserId)
            ->where('status', ErpVisit::STATUS_OPEN)
            ->first();

        if ($open) {
            if ((string) $open->customer_id === $customerId) {
                return $open->toApiArray();
            }

            throw new ErpException(
                'VISIT_ALREADY_OPEN',
                'ჯერ დაასრულეთ ვიზიტი: '.($open->customer_name ?: $open->customer_id),
                409,
                [
                    'customerId' => (string) $open->customer_id,
                    'customerName' => $open->customer_name,
                    'visitId' => $open->id,
                ],
            );
        }

        $row = ErpVisit::query()->create([
            'user_id' => $ownerUserId,
            'id_gvari' => $idGvari,
            'customer_id' => $customerId,
            'customer_name' => $customer->name,
            'status' => ErpVisit::STATUS_OPEN,
            'started_at' => Carbon::now('Asia/Tbilisi'),
            'latitude' => $latitude,
            'longitude' => $longitude,
        ]);

        return $row->toApiArray();
    }

    /**
     * @param  array{outcome: string, latitude?: string|null, longitude?: string|null}  $input
     * @return array<string, mixed>
     */
    public function finish(User $actor, int $ownerUserId, int $id, array $input): array
    {
        $this->assertSalesRep($actor);

        $outcome = (string) $input['outcome'];
        if (! in_array($outcome, [ErpVisit::STATUS_ARRIVED, ErpVisit::STATUS_MISSED], true)) {
            throw new ErpException('INVALID_OUTCOME', 'ვიზიტის სტატუსი არასწორია.', 422);
        }

        $row = ErpVisit::query()
            ->where('user_id', $ownerUserId)
            ->where('id', $id)
            ->first();

        if (! $row) {
            throw new ErpException('VISIT_NOT_FOUND', 'ვიზიტი ვერ მოიძებნა.', 404);
        }

        if ($row->status !== ErpVisit::STATUS_OPEN) {
            return $row->toApiArray();
        }

        [$latitude, $longitude] = $this->coords($input['latitude'] ?? null, $input['longitude'] ?? null);

        $row->update([
            'status' => $outcome,
            'ended_at' => Carbon::now('Asia/Tbilisi'),
            'latitude' => $latitude ?? $row->latitude,
            'longitude' => $longitude ?? $row->longitude,
        ]);

        return $row->fresh()?->toApiArray() ?? $row->toApiArray();
    }

    private function assertSalesRep(User $actor): void
    {
        if ($actor->role !== UserRole::SalesRep) {
            throw new ErpException('VISIT_READ_ONLY', 'ვიზიტს მხოლოდ სეილსი იწყებს.', 403);
        }
    }

    /**
     * @return array{0: string|null, 1: string|null}
     */
    private function coords(mixed $latitude, mixed $longitude): array
    {
        $lat = $latitude === null ? '' : trim((string) $latitude);
        $lng = $longitude === null ? '' : trim((string) $longitude);
        if ($lat === '' && $lng === '') {
            return [null, null];
        }

        if (! GeoPoint::isPlottable($lat, $lng)) {
            throw new ErpException('INVALID_COORD', 'კოორდინატი არასწორია.', 422);
        }

        return [number_format((float) $lat, 7, '.', ''), number_format((float) $lng, 7, '.', '')];
    }
}
