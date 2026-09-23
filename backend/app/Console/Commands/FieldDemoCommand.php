<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Erp\Contracts\ErpProvider;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\ItemRecord;
use App\Erp\Exceptions\ErpException;
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
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class FieldDemoCommand extends Command
{
    protected $signature = 'field:demo
        {--clear : Delete only the demo rows and their files}
        {--all : Delete every field row, demo and real}
        {--sales= : Limit to one sales rep by id, email or name}
        {--days=7 : How many past days to fill}
        {--force : Skip the confirmation of --all}';

    protected $description = 'Seed tagged demo field work (visits, photos, surveys, coaching, tasks, shelf audits, promo plans) for the supervisor and sales rep screens.';

    private const MARK = '[demo]';

    private const TAG = 'demo';

    private const MANIFEST = 'field-demo.json';

    private const TZ = 'Asia/Tbilisi';

    public function handle(ErpProvider $erp): int
    {
        if ($this->option('all')) {
            return $this->wipeEverything();
        }

        if ($this->option('clear')) {
            return $this->clearDemo();
        }

        return $this->seed($erp);
    }

    private function seed(ErpProvider $erp): int
    {
        $reps = $this->targetReps();
        if ($reps === []) {
            $this->error('No sales rep with an FMG IdGvari. Map Users → IdGvari in Filament first.');

            return self::FAILURE;
        }

        $days = max(1, min(30, (int) $this->option('days')));
        $manifest = $this->manifest();

        foreach ($reps as $rep) {
            $supervisor = $rep->supervisor_id
                ? User::query()->whereKey($rep->supervisor_id)->first()
                : null;

            try {
                $customers = $erp->customers()
                    ->listForPreseller((int) $rep->id_gvari, null, null, 12, 'all')
                    ->items;
                $items = $customers === []
                    ? []
                    : $erp->products()->listForCustomer((int) $rep->id_gvari, $customers[0], null, null, 8)->items;
            } catch (ErpException $e) {
                $this->error($rep->name.': '.$e->getMessage());

                return self::FAILURE;
            } catch (Throwable) {
                $this->error('FMG ბაზა ამჟამად მიუწვდომელია.');

                return self::FAILURE;
            }

            /** @var list<CustomerRecord> $customers */
            $customers = array_values(array_filter(
                $customers,
                static fn (CustomerRecord $row) => $row->customerId !== '',
            ));

            if ($customers === []) {
                $this->warn($rep->name.': no customers on the FMG route, skipped.');

                continue;
            }

            $this->line($rep->name.': '.count($customers).' customers, '.$days.' days');
            $visitIds = [];
            $photoIds = [];

            for ($back = $days - 1; $back >= 0; $back--) {
                $date = Carbon::now(self::TZ)->subDays($back)->startOfDay();
                $perDay = min(4, count($customers));
                $offset = ($days - $back) % max(1, count($customers));

                for ($slot = 0; $slot < $perDay; $slot++) {
                    $customer = $customers[($offset + $slot) % count($customers)];
                    $missed = $back === 2 && $slot === 1;
                    $startedAt = (clone $date)->setTime(10, 0)->addMinutes($slot * 75);
                    $endedAt = (clone $startedAt)->addMinutes($missed ? 6 : 24);

                    $visit = ErpVisit::query()->create([
                        'user_id' => $rep->id,
                        'id_gvari' => (int) $rep->id_gvari,
                        'customer_id' => $customer->customerId,
                        'customer_name' => $customer->name,
                        'status' => $missed ? ErpVisit::STATUS_MISSED : ErpVisit::STATUS_ARRIVED,
                        'started_at' => $startedAt,
                        'ended_at' => $endedAt,
                        'latitude' => $customer->latitude,
                        'longitude' => $customer->longitude,
                    ]);
                    $visitIds[] = (int) $visit->id;

                    if ($missed) {
                        continue;
                    }

                    foreach ([ErpVisitPhoto::PHASE_BEFORE, ErpVisitPhoto::PHASE_END] as $index => $phase) {
                        $photoId = $this->storePhoto(
                            $rep,
                            $customer,
                            (int) $visit->id,
                            $phase,
                            (clone $startedAt)->addMinutes($index === 0 ? 1 : 22),
                        );
                        if ($photoId !== null) {
                            $photoIds[] = $photoId;
                        }
                    }

                    if ($slot % 3 !== 2) {
                        $survey = ErpVisitSurvey::query()->create([
                            'visit_id' => $visit->id,
                            'user_id' => $rep->id,
                            'id_gvari' => (int) $rep->id_gvari,
                            'customer_id' => $customer->customerId,
                            'customer_name' => $customer->name,
                            'shelf_stocked' => $slot !== 1,
                            'price_visible' => true,
                            'promo_present' => $slot % 2 === 0,
                            'competitor_seen' => $slot === 1,
                        ]);
                        $manifest['surveys'][] = (int) $survey->id;
                    }

                    if ($supervisor && $back <= 2 && $slot === 0) {
                        $coaching = ErpVisitCoaching::query()->create([
                            'visit_id' => $visit->id,
                            'user_id' => $rep->id,
                            'supervisor_id' => $supervisor->id,
                            'rating' => 3 + ($back % 3),
                            'note' => self::MARK.' ფასის ეტიკეტი უფრო თვალსაჩინოდ დადე.',
                        ]);
                        $manifest['coaching'][] = (int) $coaching->id;
                    }
                }
            }

            $shelfPhotoIds = [];
            foreach (array_slice(array_reverse($visitIds), 0, 2) as $visitId) {
                $visit = ErpVisit::query()->whereKey($visitId)->first();
                if (! $visit || $items === []) {
                    continue;
                }
                $customer = $this->matchCustomer($customers, (string) $visit->customer_id);
                $photoId = $this->storePhoto(
                    $rep,
                    $customer,
                    $visitId,
                    ErpVisitPhoto::PHASE_SHELF,
                    Carbon::parse($visit->started_at->format('Y-m-d H:i:s'), self::TZ)->addMinutes(15),
                );
                if ($photoId !== null) {
                    $photoIds[] = $photoId;
                    $shelfPhotoIds[] = $photoId;
                }

                $audit = ErpShelfAudit::query()->create([
                    'user_id' => $rep->id,
                    'id_gvari' => (int) $rep->id_gvari,
                    'customer_id' => $visit->customer_id,
                    'customer_name' => $visit->customer_name,
                    'visit_id' => $visitId,
                    'photo_id' => $photoId,
                ]);
                $manifest['shelfAudits'][] = (int) $audit->id;

                foreach (array_slice($items, 0, 4) as $index => $item) {
                    /** @var ItemRecord $item */
                    ErpShelfAuditLine::query()->create([
                        'audit_id' => $audit->id,
                        'item_id' => $item->itemId,
                        'item_name' => $item->name,
                        'status' => [0 => 'present', 1 => 'low', 2 => 'missing', 3 => 'present'][$index] ?? 'present',
                    ]);
                }
            }

            $author = $supervisor ?? $rep;
            $today = Carbon::now(self::TZ)->startOfDay();
            $taskPhoto = $photoIds[0] ?? null;
            $taskPlan = [
                ['title' => 'ფასის ეტიკეტი განაახლე', 'status' => 'open', 'due' => 0, 'checked' => false],
                ['title' => 'მაცივრის თარო გაასწორე', 'status' => 'open', 'due' => -2, 'checked' => false],
                ['title' => 'აქციის სტენდი დადგი', 'status' => 'done', 'due' => -1, 'checked' => false],
                ['title' => 'ვადაგასული პროდუქტი ჩამოწერე', 'status' => 'done', 'due' => 1, 'checked' => false],
                ['title' => 'კონკურენტის ფასი გადაიღე', 'status' => 'done', 'due' => -3, 'checked' => true],
                ['title' => 'ახალი SKU შესთავაზე', 'status' => 'done', 'due' => -4, 'checked' => true],
            ];

            foreach ($taskPlan as $index => $plan) {
                $customer = $customers[$index % count($customers)];
                $done = $plan['status'] === 'done';
                $task = ErpTask::query()->create([
                    'created_by' => $author->id,
                    'user_id' => $rep->id,
                    'id_gvari' => (int) $rep->id_gvari,
                    'customer_id' => $customer->customerId,
                    'customer_name' => $customer->name,
                    'photo_id' => $index === 0 ? $taskPhoto : null,
                    'title' => self::MARK.' '.$plan['title'],
                    'note' => self::MARK.' სატესტო დავალება',
                    'due_on' => (clone $today)->addDays((int) $plan['due'])->toDateString(),
                    'status' => $done ? ErpTask::STATUS_DONE : ErpTask::STATUS_OPEN,
                    'completed_at' => $done ? (clone $today)->setTime(16, 20) : null,
                    'checked_by' => $plan['checked'] && $supervisor ? $supervisor->id : null,
                    'checked_at' => $plan['checked'] && $supervisor ? (clone $today)->setTime(18, 5) : null,
                ]);
                $manifest['tasks'][] = (int) $task->id;
            }

            $monthStart = Carbon::now(self::TZ)->startOfMonth();
            $promoPlan = [
                ['title' => 'ლუდის მეორე თარო', 'from' => 1, 'to' => 9, 'status' => ErpPromoPlan::DONE],
                ['title' => 'სასაჩუქრე ნაკრები კასაზე', 'from' => 8, 'to' => 18, 'status' => ErpPromoPlan::ACTIVE],
                ['title' => 'მაცივრის ბრენდირება', 'from' => 15, 'to' => 25, 'status' => ErpPromoPlan::ACTIVE],
                ['title' => 'თვის ბოლოს ფასდაკლება', 'from' => 22, 'to' => 30, 'status' => ErpPromoPlan::PLANNED],
            ];

            foreach ($promoPlan as $index => $plan) {
                $customer = $customers[($index + 1) % count($customers)];
                $row = ErpPromoPlan::query()->create([
                    'created_by' => $author->id,
                    'user_id' => $rep->id,
                    'id_gvari' => (int) $rep->id_gvari,
                    'customer_id' => $customer->customerId,
                    'customer_name' => $customer->name,
                    'title' => self::MARK.' '.$plan['title'],
                    'starts_on' => (clone $monthStart)->addDays((int) $plan['from'] - 1)->toDateString(),
                    'ends_on' => (clone $monthStart)->addDays((int) $plan['to'] - 1)->toDateString(),
                    'status' => $plan['status'],
                    'photo_id' => $plan['status'] === ErpPromoPlan::DONE ? ($shelfPhotoIds[0] ?? null) : null,
                    'note' => self::MARK.' სატესტო გეგმა',
                ]);
                $manifest['promos'][] = (int) $row->id;
            }

            $manifest['visits'] = [...$manifest['visits'], ...$visitIds];
            $manifest['photos'] = [...$manifest['photos'], ...$photoIds];

            $this->info(sprintf(
                '  %d visits, %d photos, %d tasks, %d promo plans',
                count($visitIds),
                count($photoIds),
                count($taskPlan),
                count($promoPlan),
            ));
        }

        $this->writeManifest($manifest);
        $this->comment('Demo rows carry the '.self::MARK.' prefix and the #'.self::TAG.' photo tag. Remove them with: php artisan field:demo --clear');

        return self::SUCCESS;
    }

    private function clearDemo(): int
    {
        $manifest = $this->manifest();

        $photos = ErpVisitPhoto::query()
            ->where('comment', 'like', self::MARK.'%')
            ->orWhereIn('id', $manifest['photos'] ?: [-1])
            ->get();
        $photoIds = $photos->pluck('id')->map(fn ($id) => (int) $id)->all();
        $visitIds = array_values(array_unique([
            ...$manifest['visits'],
            ...$photos->pluck('visit_id')->filter()->map(fn ($id) => (int) $id)->all(),
        ]));

        $guardPhotos = $photoIds ?: [-1];
        $guardVisits = $visitIds ?: [-1];

        $tasks = ErpTask::query()
            ->where('title', 'like', self::MARK.'%')
            ->orWhereIn('id', $manifest['tasks'] ?: [-1])
            ->delete();

        $promos = ErpPromoPlan::query()
            ->where('title', 'like', self::MARK.'%')
            ->orWhereIn('id', $manifest['promos'] ?: [-1])
            ->delete();

        $auditIds = ErpShelfAudit::query()
            ->whereIn('id', $manifest['shelfAudits'] ?: [-1])
            ->orWhereIn('visit_id', $guardVisits)
            ->orWhereIn('photo_id', $guardPhotos)
            ->pluck('id')
            ->all();
        ErpShelfAuditLine::query()->whereIn('audit_id', $auditIds ?: [-1])->delete();
        $audits = ErpShelfAudit::query()->whereIn('id', $auditIds ?: [-1])->delete();

        $surveys = ErpVisitSurvey::query()
            ->whereIn('id', $manifest['surveys'] ?: [-1])
            ->orWhereIn('visit_id', $guardVisits)
            ->delete();

        $coaching = ErpVisitCoaching::query()
            ->whereIn('id', $manifest['coaching'] ?: [-1])
            ->orWhereIn('visit_id', $guardVisits)
            ->delete();

        $files = 0;
        foreach ($photos as $photo) {
            if ($photo->path && Storage::disk('local')->exists($photo->path)) {
                Storage::disk('local')->delete($photo->path);
                $files++;
            }
        }
        ErpVisitPhoto::query()->whereIn('id', $guardPhotos)->delete();
        $visits = ErpVisit::query()->whereIn('id', $guardVisits)->delete();

        Storage::disk('local')->delete(self::MANIFEST);

        $this->table(
            ['Table', 'Deleted'],
            [
                ['erp_visits', $visits],
                ['erp_visit_photos', count($photoIds)],
                ['erp_visit_surveys', $surveys],
                ['erp_visit_coaching', $coaching],
                ['erp_tasks', $tasks],
                ['erp_shelf_audits', $audits],
                ['erp_promo_plans', $promos],
                ['photo files', $files],
            ],
        );
        $this->comment('Real rows without the '.self::MARK.' mark stayed untouched.');

        return self::SUCCESS;
    }

    private function wipeEverything(): int
    {
        if (! $this->option('force') && ! $this->confirm('Delete every field row, including the real photos and reviews?', false)) {
            $this->comment('Nothing was deleted.');

            return self::SUCCESS;
        }

        foreach (ErpVisitPhoto::query()->get() as $photo) {
            if ($photo->path && Storage::disk('local')->exists($photo->path)) {
                Storage::disk('local')->delete($photo->path);
            }
        }

        DB::transaction(function (): void {
            ErpShelfAuditLine::query()->delete();
            ErpShelfAudit::query()->delete();
            ErpPromoPlan::query()->delete();
            ErpTask::query()->delete();
            ErpVisitCoaching::query()->delete();
            ErpVisitSurvey::query()->delete();
            ErpVisitPhoto::query()->delete();
            ErpVisit::query()->delete();
        });

        Storage::disk('local')->delete(self::MANIFEST);
        $this->info('All field tables are empty.');

        return self::SUCCESS;
    }

    /**
     * @return list<User>
     */
    private function targetReps(): array
    {
        $query = User::query()
            ->where('role', UserRole::SalesRep)
            ->whereNotNull('id_gvari');

        $filter = trim((string) $this->option('sales'));
        if ($filter !== '') {
            $query->where(function ($inner) use ($filter): void {
                $inner->where('email', $filter)
                    ->orWhere('name', 'like', '%'.$filter.'%');
                if (ctype_digit($filter)) {
                    $inner->orWhere('id', (int) $filter);
                }
            });
        }

        return $query->orderBy('id')->get()->all();
    }

    /**
     * @param  list<CustomerRecord>  $customers
     */
    private function matchCustomer(array $customers, string $customerId): CustomerRecord
    {
        foreach ($customers as $customer) {
            if ($customer->customerId === $customerId) {
                return $customer;
            }
        }

        return $customers[0];
    }

    private function storePhoto(
        User $rep,
        CustomerRecord $customer,
        int $visitId,
        string $phase,
        Carbon $takenAt,
    ): ?int {
        $binary = $this->jpeg($customer->name, $phase, $takenAt);
        if ($binary === null) {
            return null;
        }

        $path = 'visit-photos/'.$rep->id.'/demo_'.$visitId.'_'.$phase.'_'.$takenAt->format('His').'.jpg';
        Storage::disk('local')->put($path, $binary);

        $photo = ErpVisitPhoto::query()->create([
            'user_id' => $rep->id,
            'id_gvari' => (int) $rep->id_gvari,
            'customer_id' => $customer->customerId,
            'customer_name' => $customer->name,
            'visit_id' => $visitId,
            'phase' => $phase,
            'comment' => self::MARK.' '.$phase,
            'tags' => [self::TAG, $phase],
            'taken_at' => $takenAt,
            'latitude' => $customer->latitude,
            'longitude' => $customer->longitude,
            'path' => $path,
            'mime' => 'image/jpeg',
        ]);

        return (int) $photo->id;
    }

    private function jpeg(string $customerName, string $phase, Carbon $takenAt): ?string
    {
        if (! function_exists('imagecreatetruecolor') || ! function_exists('imagejpeg')) {
            $this->warn('PHP GD is off, demo photos are skipped.');

            return null;
        }

        $width = 640;
        $height = 480;
        $image = imagecreatetruecolor($width, $height);
        if ($image === false) {
            return null;
        }

        $tone = [
            ErpVisitPhoto::PHASE_BEFORE => [37, 99, 235],
            ErpVisitPhoto::PHASE_END => [22, 163, 74],
            ErpVisitPhoto::PHASE_SURVEY => [217, 119, 6],
            ErpVisitPhoto::PHASE_SHELF => [124, 58, 237],
        ][$phase] ?? [71, 85, 105];

        $background = imagecolorallocate($image, $tone[0], $tone[1], $tone[2]);
        $shade = imagecolorallocate($image, (int) ($tone[0] * 0.75), (int) ($tone[1] * 0.75), (int) ($tone[2] * 0.75));
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefilledrectangle($image, 0, 0, $width, $height, $background);
        imagefilledrectangle($image, 0, (int) ($height * 0.62), $width, $height, $shade);

        $lines = [
            strtoupper($phase),
            $this->ascii($customerName),
            $takenAt->format('Y-m-d H:i'),
            'DEMO',
        ];
        foreach ($lines as $index => $text) {
            imagestring($image, 5, 28, 40 + $index * 34, $text, $white);
        }

        ob_start();
        imagejpeg($image, null, 78);
        $binary = ob_get_clean();
        imagedestroy($image);

        return $binary === false ? null : $binary;
    }

    private function ascii(string $text): string
    {
        $clean = preg_replace('/[^\x20-\x7E]/', '', $text) ?? '';
        $clean = trim($clean);

        return $clean === '' ? 'CUSTOMER' : mb_substr($clean, 0, 28);
    }

    /**
     * @return array{visits: list<int>, photos: list<int>, surveys: list<int>, coaching: list<int>, tasks: list<int>, shelfAudits: list<int>, promos: list<int>}
     */
    private function manifest(): array
    {
        $empty = [
            'visits' => [],
            'photos' => [],
            'surveys' => [],
            'coaching' => [],
            'tasks' => [],
            'shelfAudits' => [],
            'promos' => [],
        ];

        if (! Storage::disk('local')->exists(self::MANIFEST)) {
            return $empty;
        }

        $raw = json_decode((string) Storage::disk('local')->get(self::MANIFEST), true);
        if (! is_array($raw)) {
            return $empty;
        }

        foreach (array_keys($empty) as $key) {
            $values = $raw[$key] ?? [];
            $empty[$key] = is_array($values)
                ? array_values(array_map(static fn ($id) => (int) $id, $values))
                : [];
        }

        return $empty;
    }

    /**
     * @param  array<string, list<int>>  $manifest
     */
    private function writeManifest(array $manifest): void
    {
        Storage::disk('local')->put(
            self::MANIFEST,
            (string) json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        );
    }
}
