<?php

namespace App\Erp\Fmg;

use App\Enums\UserRole;
use App\Erp\Exceptions\ErpException;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Throwable;

final class ManagerTeamSync
{
    public function __construct(private readonly FmgConnection $fmg) {}

    /**
     * Link managers to supervisors (GvariView.Super) and sales (IdGvari) where Manag matches the manager name.
     *
     * @return list<array{name: string, supervisors: int, sales: int}>
     */
    public function relink(): array
    {
        try {
            $rows = $this->fmg->connection()->select(
                'SELECT '
                .'g.IdGvari, '
                .FmgNvarchar::col('g.Gvari', 'gvari').', '
                .FmgNvarchar::col('g.Manag', 'manag').', '
                .FmgNvarchar::col('g.Super', 'super')
                .' FROM dbo.GvariView AS g',
            );
        } catch (ErpException $e) {
            throw $e;
        } catch (Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        /** @var array<string, array{gvaris: array<int, true>, supers: array<string, true>}> $byManager */
        $byManager = [];
        foreach ($rows as $row) {
            $manag = $this->cleanName(FmgNvarchar::decode($row->manag ?? null));
            $gvari = $this->cleanName(FmgNvarchar::decode($row->gvari ?? null));
            $super = $this->cleanName(FmgNvarchar::decode($row->super ?? null));
            $idGvari = (int) ($row->IdGvari ?? 0);
            if ($manag === '' || $idGvari <= 0 || $gvari === '' || str_starts_with($gvari, '#')) {
                continue;
            }
            $managKey = mb_strtolower($manag, 'UTF-8');
            $byManager[$managKey]['gvaris'][$idGvari] = true;
            if ($super !== '' && ! str_starts_with($super, '#')) {
                $byManager[$managKey]['supers'][$super] = true;
            }
        }

        $result = [];
        $managers = User::query()
            ->where(function ($query): void {
                $query->where('role', UserRole::Manager)
                    ->orWhereRaw('lower(trim(role)) = ?', ['manager']);
            })
            ->orderBy('id')
            ->get();

        foreach ($managers as $manager) {
            $name = $this->cleanName((string) $manager->name);
            $bucket = $byManager[mb_strtolower($name, 'UTF-8')] ?? ['gvaris' => [], 'supers' => []];
            $result[] = [
                'name' => $name,
                'supervisors' => $this->linkSupervisors($manager, array_keys($bucket['supers'] ?? [])),
                'sales' => $this->linkSales($manager, array_keys($bucket['gvaris'] ?? [])),
            ];
        }

        return $result;
    }

    /**
     * @param  list<string>  $superNames
     */
    private function linkSupervisors(User $manager, array $superNames): int
    {
        $wanted = [];
        foreach ($superNames as $name) {
            $clean = $this->cleanName($name);
            if ($clean !== '') {
                $wanted[mb_strtolower($clean, 'UTF-8')] = $clean;
            }
        }

        $supervisorIds = [];
        if ($wanted !== []) {
            foreach (User::query()->where('role', UserRole::Supervisor)->get() as $supervisor) {
                $key = mb_strtolower($this->cleanName((string) $supervisor->name), 'UTF-8');
                if (isset($wanted[$key])) {
                    $supervisorIds[] = (int) $supervisor->id;
                }
            }
        }

        DB::table('manager_supervisors')->where('manager_user_id', $manager->id)->delete();
        $rows = [];
        foreach (array_values(array_unique($supervisorIds)) as $supervisorId) {
            $rows[] = [
                'manager_user_id' => $manager->id,
                'supervisor_user_id' => $supervisorId,
            ];
        }
        foreach (array_chunk($rows, 400) as $chunk) {
            DB::table('manager_supervisors')->insert($chunk);
        }

        return count($rows);
    }

    /**
     * @param  list<int>  $idGvaris
     */
    private function linkSales(User $manager, array $idGvaris): int
    {
        $salesIds = $idGvaris === []
            ? collect()
            : User::query()
                ->where('role', UserRole::SalesRep)
                ->whereIn('id_gvari', $idGvaris)
                ->pluck('id');

        DB::table('manager_sales')->where('manager_user_id', $manager->id)->delete();
        $rows = [];
        foreach ($salesIds as $salesId) {
            $rows[] = [
                'manager_user_id' => $manager->id,
                'sales_user_id' => (int) $salesId,
            ];
        }
        foreach (array_chunk($rows, 400) as $chunk) {
            DB::table('manager_sales')->insert($chunk);
        }

        return count($rows);
    }

    private function cleanName(string $name): string
    {
        $name = trim($name);
        $name = preg_replace('/\s+/u', ' ', $name) ?? $name;

        return $name;
    }
}
