<?php

namespace App\Console\Commands;

use App\Erp\Fmg\FmgNvarchar;
use App\Erp\Exceptions\ErpException;
use App\Erp\Fmg\FmgConnection;
use Illuminate\Console\Command;
use Throwable;

class FmgPresellersCommand extends Command
{
    protected $signature = 'fmg:presellers';

    protected $description = 'Read-only list of FMG GvariView rows for Filament IdGvari mapping. Does not guess which user maps to which IdGvari.';

    public function handle(FmgConnection $fmg): int
    {
        try {
            $rows = $fmg->connection()->select(
                'SELECT IdGvari, IsPreseller, GvariActive, '
                .FmgNvarchar::col('Gvari', 'Gvari')
                .' FROM dbo.GvariView ORDER BY IdGvari',
            );
        } catch (ErpException $e) {
            $this->error($e->getMessage());
            $this->comment('Fill FMG_SQL_* in backend/.env, then map Users → FMG IdGvari in Filament. Do not invent IDs.');

            return self::FAILURE;
        } catch (Throwable) {
            $this->error('FMG ბაზა ამჟამად მიუწვდომელია.');

            return self::FAILURE;
        }

        $table = [];
        foreach ($rows as $row) {
            $r = (array) $row;
            $table[] = [
                $r['IdGvari'] ?? '',
                FmgNvarchar::decode($r['Gvari'] ?? ''),
                $this->boolish($r['IsPreseller'] ?? null),
                $this->boolish($r['GvariActive'] ?? null),
            ];
        }

        $this->table(['IdGvari', 'Gvari', 'IsPreseller', 'GvariActive'], $table);
        $this->comment('Map the correct IdGvari onto the salesman user in Filament. Do not pick an ID by name guesswork.');

        return self::SUCCESS;
    }

    private function boolish(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return ((int) $value) === 1 ? '1' : (string) $value;
    }
}
