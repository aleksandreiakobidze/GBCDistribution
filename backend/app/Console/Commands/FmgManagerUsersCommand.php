<?php

namespace App\Console\Commands;

use App\Erp\Exceptions\ErpException;
use App\Erp\Fmg\ManagerTeamSync;
use Illuminate\Console\Command;
use Throwable;

class FmgManagerUsersCommand extends Command
{
    protected $signature = 'fmg:manager-users';

    protected $description = 'Relink Manager users to supervisors (GvariView.Super) and sales (IdGvari) where Manag matches the manager name.';

    public function handle(ManagerTeamSync $teams): int
    {
        try {
            $rows = $teams->relink();
        } catch (ErpException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        } catch (Throwable $e) {
            $this->error('FMG ბაზა ამჟამად მიუწვდომელია.');
            $this->comment($e->getMessage());

            return self::FAILURE;
        }

        $linked = 0;
        $empty = 0;
        foreach ($rows as $row) {
            if ($row['supervisors'] === 0 && $row['sales'] === 0) {
                $empty++;
                $this->line("{$row['name']}: ვაიზერი/სეილსმენი არ მოიძებნა.");
            } else {
                $linked++;
                $this->line("{$row['name']}: {$row['supervisors']} ვაიზერი, {$row['sales']} სეილსმენი.");
            }
        }

        $this->info("გუნდი განახლდა {$linked} მენეჯერზე, ცარიელი დარჩა {$empty}.");

        return self::SUCCESS;
    }
}
