<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class SupervisorSeeder extends Seeder
{
    public function run(): void
    {
        Role::firstOrCreate(['name' => 'supervisor', 'guard_name' => 'web']);

        $supervisor = User::query()->firstOrCreate(
            ['email' => 'sofo@bsc.ge'],
            [
                'name' => 'Sofo Maisuradze',
                'phone' => '+995 555 150 150',
                'role' => UserRole::Supervisor,
                'password' => 'password',
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        );

        if ($supervisor->role !== UserRole::Supervisor) {
            $supervisor->role = UserRole::Supervisor;
            $supervisor->id_gvari = null;
            $supervisor->save();
        }

        $supervisor->syncRoles(['supervisor']);

        User::query()
            ->where('email', 'nino@bsc.ge')
            ->update(['supervisor_id' => $supervisor->id]);
    }
}
