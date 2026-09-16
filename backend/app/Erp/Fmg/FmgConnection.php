<?php

namespace App\Erp\Fmg;

use App\Erp\Exceptions\ErpException;
use Illuminate\Support\Facades\DB;
use Throwable;

final class FmgConnection
{
    public function configured(): bool
    {
        return filled(config('database.connections.fmg.host'))
            && filled(config('database.connections.fmg.database'));
    }

    public function connection()
    {
        if (! $this->configured()) {
            throw new ErpException(
                'SOURCE_UNAVAILABLE',
                'FMG ბაზასთან კავშირი არ არის გამართული.',
                503,
            );
        }

        if (! extension_loaded('pdo_sqlsrv') && ! extension_loaded('sqlsrv')) {
            throw new ErpException(
                'SOURCE_UNAVAILABLE',
                'FMG ბაზასთან კავშირი შეუძლებელია (sqlsrv გაფართოება არ არის).',
                503,
            );
        }

        try {
            return DB::connection('fmg');
        } catch (Throwable) {
            throw new ErpException(
                'SOURCE_UNAVAILABLE',
                'FMG ბაზა ამჟამად მიუწვდომელია.',
                503,
            );
        }
    }

    public function ping(): bool
    {
        if (! $this->configured()) {
            return false;
        }

        try {
            $this->connection()->select('SELECT 1 AS ok');

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
