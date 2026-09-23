<?php

namespace App\Erp;

use App\Enums\UserRole;
use App\Erp\Contracts\ErpProvider;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\GeoPoint;
use App\Models\ErpVisit;
use App\Models\ErpVisitPhoto;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

final class VisitPhotoService
{
    public function __construct(private readonly ErpProvider $erp)
    {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function list(int $ownerUserId, string $customerId): array
    {
        return ErpVisitPhoto::query()
            ->where('user_id', $ownerUserId)
            ->where('customer_id', $customerId)
            ->orderByDesc('taken_at')
            ->orderByDesc('id')
            ->limit(24)
            ->get()
            ->map(fn (ErpVisitPhoto $row) => $row->toApiArray())
            ->values()
            ->all();
    }

    public function file(int $ownerUserId, int $id): ErpVisitPhoto
    {
        $row = ErpVisitPhoto::query()
            ->where('user_id', $ownerUserId)
            ->where('id', $id)
            ->first();

        if (! $row || ! Storage::disk('local')->exists($row->path)) {
            throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
        }

        return $row;
    }

    /**
     * @param  array{customerId: string, phase: string, comment?: string|null, tags?: string|null, latitude?: string|null, longitude?: string|null}  $input
     * @return array<string, mixed>
     */
    public function store(User $actor, int $ownerUserId, int $idGvari, array $input, UploadedFile $file): array
    {
        if ($actor->role !== UserRole::SalesRep) {
            throw new ErpException('PHOTO_READ_ONLY', 'ფოტოს მხოლოდ სეილსი იღებს.', 403);
        }

        $phase = (string) $input['phase'];
        $allowed = [
            ErpVisitPhoto::PHASE_BEFORE,
            ErpVisitPhoto::PHASE_END,
            ErpVisitPhoto::PHASE_SURVEY,
            ErpVisitPhoto::PHASE_SHELF,
        ];
        if (! in_array($phase, $allowed, true)) {
            throw new ErpException('INVALID_PHASE', 'ფოტოს ეტაპი არასწორია.', 422);
        }

        $customerId = (string) $input['customerId'];
        $customer = $this->erp->customers()->getAuthorized($idGvari, $customerId);
        $needsVisit = $phase !== ErpVisitPhoto::PHASE_BEFORE;
        $visitId = $needsVisit ? $this->endVisitId($ownerUserId, $customerId) : null;
        [$latitude, $longitude] = $this->coords($input['latitude'] ?? null, $input['longitude'] ?? null);

        $comment = isset($input['comment']) ? trim((string) $input['comment']) : null;
        if ($comment === '') {
            $comment = null;
        }
        if ($comment !== null && mb_strlen($comment) > 300) {
            throw new ErpException('NOTE_TOO_LONG', 'შენიშვნა ძალიან გრძელია.', 422);
        }

        $path = $file->store('visit-photos/'.$ownerUserId, 'local');
        if ($path === false) {
            throw new ErpException('PHOTO_STORE_FAILED', 'ფოტო ვერ შეინახა.', 500);
        }

        $row = ErpVisitPhoto::query()->create([
            'user_id' => $ownerUserId,
            'id_gvari' => $idGvari,
            'customer_id' => $customerId,
            'customer_name' => $customer->name,
            'visit_id' => $visitId,
            'phase' => $phase,
            'comment' => $comment,
            'tags' => $this->tags($input['tags'] ?? null),
            'taken_at' => Carbon::now('Asia/Tbilisi'),
            'latitude' => $latitude,
            'longitude' => $longitude,
            'path' => $path,
            'mime' => (string) ($file->getMimeType() ?: 'image/jpeg'),
        ]);

        return $row->toApiArray();
    }

    private function endVisitId(int $ownerUserId, string $customerId): int
    {
        $open = ErpVisit::query()
            ->where('user_id', $ownerUserId)
            ->where('customer_id', $customerId)
            ->where('status', ErpVisit::STATUS_OPEN)
            ->first();
        if ($open) {
            return (int) $open->id;
        }

        $tz = 'Asia/Tbilisi';
        $finished = ErpVisit::query()
            ->where('user_id', $ownerUserId)
            ->where('customer_id', $customerId)
            ->whereIn('status', [ErpVisit::STATUS_ARRIVED, ErpVisit::STATUS_MISSED])
            ->whereBetween('started_at', [Carbon::now($tz)->startOfDay(), Carbon::now($tz)->endOfDay()])
            ->orderByDesc('id')
            ->first();
        if (! $finished) {
            throw new ErpException('VISIT_REQUIRED', 'ბოლოს ფოტო ამ კლიენტის დღევანდელ ვიზიტს სჭირდება.', 422);
        }

        return (int) $finished->id;
    }

    /**
     * @return list<string>
     */
    private function tags(mixed $raw): array
    {
        $text = trim((string) ($raw ?? ''));
        if ($text === '') {
            return [];
        }

        $parts = preg_split('/[\s,]+/u', $text) ?: [];
        $tags = [];
        foreach ($parts as $part) {
            $tag = ltrim(trim((string) $part), '#');
            if ($tag === '' || isset($tags[$tag])) {
                continue;
            }
            if (mb_strlen($tag) > 40) {
                throw new ErpException('TAG_TOO_LONG', 'თეგი ძალიან გრძელია.', 422);
            }
            $tags[$tag] = $tag;
            if (count($tags) >= 8) {
                break;
            }
        }

        return array_values($tags);
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
