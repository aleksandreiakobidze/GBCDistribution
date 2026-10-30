<?php

namespace App\Erp\Fmg;

use App\Enums\UserRole;
use App\Erp\Exceptions\ErpException;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Throwable;

final class SupervisorTeamSync
{
    public function __construct(private readonly FmgConnection $fmg) {}

    /**
     * Replace every supervisor's salespeople from active OrgView.OrgDesc2 and OrgGvariView.
     * Names that start with # are skipped. Does not create users or change passwords.
     *
     * @return list<array{name: string, count: int}>
     */
    public function relink(): array
    {
        try {
            $connection = $this->fmg->connection();
            $orgs = $connection->select(
                'SELECT o.IdOrg, '.FmgNvarchar::col('o.OrgDesc2', 'orgdesc2')
                ." FROM dbo.OrgView AS o WHERE o.Active = 1 AND o.OrgDesc2 <> ''",
            );
            $people = $connection->select(
                'SELECT og.IdOrg, og.IdGvari, '.FmgNvarchar::col('og.Gvari', 'gvari')
                .' FROM dbo.OrgGvariView AS og WHERE og.Active = 1',
            );
        } catch (ErpException $e) {
            throw $e;
        } catch (Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        $orgNames = [];
        foreach ($orgs as $row) {
            $name = $this->cleanName(FmgNvarchar::decode($row->orgdesc2 ?? null));
            $orgId = (int) ($row->IdOrg ?? 0);
            if ($name === '' || $orgId <= 0) {
                continue;
            }
            $orgNames[$orgId] = $name;
        }

        $team = [];
        foreach ($people as $row) {
            $orgId = (int) ($row->IdOrg ?? 0);
            $idGvari = (int) ($row->IdGvari ?? 0);
            $gvari = $this->cleanName(FmgNvarchar::decode($row->gvari ?? null));
            if ($idGvari <= 0 || $gvari === '' || str_starts_with($gvari, '#') || ! isset($orgNames[$orgId])) {
                continue;
            }
            $team[$orgNames[$orgId]][$idGvari] = true;
        }

        $result = [];
        $supervisors = User::query()->where('role', UserRole::Supervisor)->orderBy('id')->get();
        foreach ($supervisors as $supervisor) {
            $name = $this->cleanName((string) $supervisor->name);
            $result[] = [
                'name' => $name,
                'count' => $this->linkTeam($supervisor, array_keys($team[$name] ?? [])),
            ];
        }

        return $result;
    }

    /**
     * @param  list<int>  $idGvaris
     */
    private function linkTeam(User $supervisor, array $idGvaris): int
    {
        $salesIds = $idGvaris === []
            ? collect()
            : User::query()
                ->where('role', UserRole::SalesRep)
                ->whereIn('id_gvari', $idGvaris)
                ->pluck('id');

        DB::table('supervisor_sales')->where('supervisor_user_id', $supervisor->id)->delete();
        $rows = [];
        foreach ($salesIds as $salesId) {
            $rows[] = [
                'supervisor_user_id' => $supervisor->id,
                'sales_user_id' => (int) $salesId,
            ];
        }
        foreach (array_chunk($rows, 400) as $chunk) {
            DB::table('supervisor_sales')->insert($chunk);
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
