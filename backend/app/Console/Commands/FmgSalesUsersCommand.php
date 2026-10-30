<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Erp\Exceptions\ErpException;
use App\Erp\Fmg\FmgConnection;
use App\Erp\Fmg\FmgNvarchar;
use App\Models\User;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Role;
use Throwable;

class FmgSalesUsersCommand extends Command
{
    protected $signature = 'fmg:sales-users';

    protected $description = 'Create or update sales reps from FMG OrgGvariView. New and matched users get password Beer1.';

    public function handle(FmgConnection $fmg): int
    {
        try {
            $rows = $fmg->connection()->select(
                'SELECT DISTINCT IdGvari, '.FmgNvarchar::col('Gvari', 'Gvari')
                ." FROM dbo.OrgGvariView WHERE Active = 1 AND Gvari NOT LIKE '#%' AND Super NOT LIKE '-%'",
            );
        } catch (ErpException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        } catch (Throwable $e) {
            $this->error('FMG ბაზა ამჟამად მიუწვდომელია.');
            $this->comment($e->getMessage());

            return self::FAILURE;
        }

        $people = [];
        foreach ($rows as $row) {
            $record = (array) $row;
            $id = (int) ($record['IdGvari'] ?? 0);
            $name = trim(FmgNvarchar::decode($record['Gvari'] ?? ''));
            if ($id <= 0 || $id > 65535 || $name === '' || str_starts_with($name, '#')) {
                continue;
            }
            if (! isset($people[$id])) {
                $people[$id] = $name;
            }
        }

        Role::firstOrCreate(['name' => 'sales_rep', 'guard_name' => 'web']);
        $created = 0;
        $updated = 0;
        foreach ($people as $id => $name) {
            $existing = User::query()->where('id_gvari', $id)->first();
            if ($existing) {
                $existing->name = $name;
                $existing->password = 'Beer1';
                $login = $this->loginName($name, $existing);
                if ($login !== null && preg_match('/^\d+@bsc\.ge$/', (string) $existing->email) === 1) {
                    $existing->email = $login;
                }
                $existing->save();
                $updated++;
                continue;
            }

            $email = $this->loginName($name, null);
            if ($email === null) {
                $this->warn("გამოტოვებულია {$id} {$name}: ეს სახელი უკვე დაკავებულია.");
                continue;
            }

            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => 'Beer1',
                'role' => UserRole::SalesRep,
                'id_gvari' => $id,
                'is_active' => true,
            ]);
            $user->email_verified_at = now();
            $user->save();
            $user->assignRole('sales_rep');
            $created++;
        }

        $this->info("სეილსმენი შეიქმნა {$created}, განახლდა {$updated}.");

        return self::SUCCESS;
    }

    private function loginName(string $name, ?User $except): ?string
    {
        $taken = User::query()
            ->where('email', $name)
            ->when($except, fn ($query) => $query->where('id', '!=', $except->id))
            ->exists();

        return $taken ? null : $name;
    }
}
