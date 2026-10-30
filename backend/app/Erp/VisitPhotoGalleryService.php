<?php

namespace App\Erp;

use App\Enums\UserRole;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\TeamAccess;
use App\Models\ErpVisitPhoto;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

final class VisitPhotoGalleryService
{
    /**
     * @param  array{salesUserId?: list<int>|int|null, customer?: string|null, day?: string|null, tag?: list<string>|string|null, rating?: list<int>|int|null, reviewed?: string|null, phase?: list<string>|string|null, q?: string|null}  $filters
     * @return list<array<string, mixed>>
     */
    public function list(User $actor, array $filters): array
    {
        $query = $this->scoped($actor)->with(['user', 'reviewer']);

        $salesIds = $this->intList($filters['salesUserId'] ?? null);
        if ($salesIds !== []) {
            foreach ($salesIds as $salesUserId) {
                $this->assertSalesFilter($actor, $salesUserId);
            }
            $query->whereIn('user_id', $salesIds);
        }

        $customer = trim((string) ($filters['customer'] ?? ''));
        if ($customer !== '') {
            $query->where(function (Builder $inner) use ($customer) {
                $inner->where('customer_id', $customer)
                    ->orWhere('customer_name', 'like', '%'.$customer.'%');
            });
        }

        $day = trim((string) ($filters['day'] ?? ''));
        if ($day !== '') {
            $query->whereBetween('taken_at', [$day.' 00:00:00', $day.' 23:59:59']);
        }

        $tags = array_values(array_filter(array_map(
            fn (string $tag) => ltrim(trim($tag), '#'),
            $this->stringList($filters['tag'] ?? null),
        ), fn (string $tag) => $tag !== ''));
        if ($tags !== []) {
            $query->where(function (Builder $inner) use ($tags) {
                foreach ($tags as $tag) {
                    $inner->orWhereJsonContains('tags', $tag);
                }
            });
        }

        $phases = $this->stringList($filters['phase'] ?? null);
        if ($phases !== []) {
            $query->whereIn('phase', $phases);
        }

        $ratings = $this->intList($filters['rating'] ?? null);
        if ($ratings !== []) {
            $query->whereIn('rating', $ratings);
        }

        $reviewed = $filters['reviewed'] ?? null;
        if ($reviewed === '1') {
            $query->whereNotNull('reviewed_at');
        } elseif ($reviewed === '0') {
            $query->whereNull('reviewed_at');
        }

        $q = trim((string) ($filters['q'] ?? ''));
        if ($q !== '') {
            $like = '%'.$q.'%';
            $query->where(function (Builder $inner) use ($like) {
                $inner->where('signature', 'like', $like)
                    ->orWhere(function (Builder $fallback) use ($like) {
                        $fallback->where(function (Builder $empty) {
                            $empty->whereNull('signature')->orWhere('signature', '');
                        })->where('customer_name', 'like', $like);
                    });
            });
        }

        return $query
            ->orderByDesc('taken_at')
            ->orderByDesc('id')
            ->limit(48)
            ->get()
            ->map(fn (ErpVisitPhoto $row) => $row->toGalleryArray())
            ->values()
            ->all();
    }

    /**
     * @param  array{signature?: string|null, reviewComment?: string|null, rating?: int|null, rotation: int, reviewed: bool}  $input
     * @return array<string, mixed>
     */
    public function update(User $actor, int $id, array $input): array
    {
        $this->assertCanReview($actor);
        $row = $this->find($actor, $id);
        $signature = isset($input['signature']) ? trim((string) $input['signature']) : null;
        $comment = isset($input['reviewComment']) ? trim((string) $input['reviewComment']) : null;
        $reviewed = (bool) $input['reviewed'];

        $row->update([
            'signature' => $signature === '' ? null : $signature,
            'review_comment' => $comment === '' ? null : $comment,
            'rating' => $input['rating'] ?? null,
            'rotation' => (int) $input['rotation'],
            'reviewed_at' => $reviewed ? Carbon::now('Asia/Tbilisi') : null,
            'reviewed_by' => $reviewed ? $actor->id : null,
        ]);

        return $row->fresh(['user', 'reviewer'])?->toGalleryArray() ?? $row->toGalleryArray();
    }

    public function file(User $actor, int $id): ErpVisitPhoto
    {
        $row = $this->find($actor, $id);
        if (! Storage::disk('local')->exists($row->path)) {
            throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
        }

        return $row;
    }

    /**
     * @param  list<int>  $ids
     * @return array{body: string, filename: string, mime: string}
     */
    public function download(User $actor, array $ids): array
    {
        $this->assertCanReview($actor);
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            throw new ErpException('PHOTO_REQUIRED', 'აირჩიეთ ფოტო.', 422);
        }
        if (count($ids) > 50) {
            throw new ErpException('TOO_MANY_PHOTOS', 'ერთდროულად 50 ფოტოზე მეტი ვერ ჩამოიტვირთება.', 422);
        }

        $rows = $this->scoped($actor)->whereIn('id', $ids)->get();
        if ($rows->count() !== count($ids)) {
            throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
        }

        foreach ($rows as $row) {
            if (! Storage::disk('local')->exists($row->path)) {
                throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
            }
        }

        if ($rows->count() === 1) {
            /** @var ErpVisitPhoto $row */
            $row = $rows->first();

            return [
                'body' => $this->jpegBytes($row),
                'filename' => $this->downloadName($row),
                'mime' => 'image/jpeg',
            ];
        }

        if (! class_exists(ZipArchive::class)) {
            throw new ErpException('ZIP_UNAVAILABLE', 'ZIP ვერ შეიქმნა.', 500);
        }

        $tmp = tempnam(sys_get_temp_dir(), 'gallery');
        if ($tmp === false) {
            throw new ErpException('ZIP_UNAVAILABLE', 'ZIP ვერ შეიქმნა.', 500);
        }

        $zip = new ZipArchive;
        if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
            throw new ErpException('ZIP_UNAVAILABLE', 'ZIP ვერ შეიქმნა.', 500);
        }

        foreach ($rows as $row) {
            $zip->addFromString($this->downloadName($row), $this->jpegBytes($row));
        }
        $zip->close();
        $body = (string) file_get_contents($tmp);
        @unlink($tmp);

        return [
            'body' => $body,
            'filename' => 'visit-photos.zip',
            'mime' => 'application/zip',
        ];
    }

    /**
     * @return list<int>
     */
    private function intList(mixed $value): array
    {
        return array_values(array_unique(array_map(
            'intval',
            array_filter(is_array($value) ? $value : [$value], fn ($item) => $item !== null && $item !== ''),
        )));
    }

    /**
     * @return list<string>
     */
    private function stringList(mixed $value): array
    {
        return array_values(array_unique(array_map(
            'strval',
            array_filter(is_array($value) ? $value : [$value], fn ($item) => $item !== null && $item !== ''),
        )));
    }

    private function find(User $actor, int $id): ErpVisitPhoto
    {
        $row = $this->scoped($actor)->with(['user', 'reviewer'])->whereKey($id)->first();
        if (! $row) {
            throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
        }

        return $row;
    }

    /**
     * @return Builder<ErpVisitPhoto>
     */
    private function scoped(User $actor): Builder
    {
        $role = TeamAccess::role($actor);
        if ($role === UserRole::Admin) {
            return ErpVisitPhoto::query();
        }
        if ($role === UserRole::Supervisor || $role === UserRole::Manager) {
            $ids = TeamAccess::salesUserIds($actor) ?? [];

            return ErpVisitPhoto::query()->whereIn('user_id', $ids === [] ? [-1] : $ids);
        }
        if ($role === UserRole::SalesRep) {
            return ErpVisitPhoto::query()->where('user_id', $actor->id);
        }

        throw new ErpException('GALLERY_FORBIDDEN', 'გალერეა სუპერვაიზორისთვისაა.', 403);
    }

    private function assertCanReview(User $actor): void
    {
        $role = TeamAccess::role($actor);
        if ($role !== UserRole::Admin && $role !== UserRole::Supervisor && $role !== UserRole::Manager) {
            throw new ErpException('GALLERY_FORBIDDEN', 'გალერეა სუპერვაიზორისთვისაა.', 403);
        }
    }

    private function assertSalesFilter(User $actor, int $salesUserId): void
    {
        TeamAccess::assertSales($actor, $salesUserId);
    }

    private function jpegBytes(ErpVisitPhoto $row): string
    {
        $absolute = Storage::disk('local')->path($row->path);
        $mime = strtolower((string) $row->mime);
        $image = match (true) {
            str_contains($mime, 'png') => @imagecreatefrompng($absolute),
            str_contains($mime, 'webp') && function_exists('imagecreatefromwebp') => @imagecreatefromwebp($absolute),
            default => @imagecreatefromjpeg($absolute),
        };
        if ($image === false) {
            throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
        }

        $rotation = (int) $row->rotation;
        if (in_array($rotation, [90, 180, 270], true)) {
            $angle = match ($rotation) {
                90 => 270,
                270 => 90,
                default => 180,
            };
            $turned = imagerotate($image, $angle, 0);
            imagedestroy($image);
            if ($turned === false) {
                throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
            }
            $image = $turned;
        }

        ob_start();
        imagejpeg($image, null, 90);
        imagedestroy($image);
        $bytes = ob_get_clean();
        if (! is_string($bytes) || $bytes === '') {
            throw new ErpException('PHOTO_NOT_FOUND', 'ფოტო ვერ მოიძებნა.', 404);
        }

        return $bytes;
    }

    private function downloadName(ErpVisitPhoto $row): string
    {
        $customer = preg_replace('/[^\p{L}\p{N}]+/u', '-', (string) ($row->customer_name ?: $row->customer_id)) ?: 'photo';
        $customer = trim((string) $customer, '-');
        if ($customer === '') {
            $customer = 'photo';
        }
        $time = $row->taken_at?->format('Ymd-Hi') ?? 'time';

        return $customer.'-'.$time.'-'.$row->id.'.jpg';
    }
}
