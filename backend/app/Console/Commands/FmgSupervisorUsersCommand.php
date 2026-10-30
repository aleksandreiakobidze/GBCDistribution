<?php

namespace App\Console\Commands;

use App\Erp\Exceptions\ErpException;
use App\Erp\Fmg\SupervisorTeamSync;
use Illuminate\Console\Command;
use Throwable;

class FmgSupervisorUsersCommand extends Command
{
    protected $signature = 'fmg:supervisor-users';

    protected $description = 'Relink existing supervisors to salespeople on organizations whose OrgDesc2 is the supervisor name. Names starting with # are skipped.';

    public function handle(SupervisorTeamSync $teams): int
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
            if ($row['count'] === 0) {
                $empty++;
                $this->line("{$row['name']}: სეილსმენი არ მოიძებნა.");
            } else {
                $linked++;
                $this->line("{$row['name']}: {$row['count']} სეილსმენი.");
            }
        }

        $this->info("გუნდი განახლდა {$linked} სუპერვაიზერზე, ცარიელი დარჩა {$empty}.");

        return self::SUCCESS;
    }
}
