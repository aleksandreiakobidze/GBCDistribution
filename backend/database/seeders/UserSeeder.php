<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $roles = ['admin', 'sales_rep', 'supervisor', 'warehouse', 'driver'];
        foreach ($roles as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        $supervisor = User::create([
            'name' => 'Sofo Maisuradze',
            'email' => 'sofo@bsc.ge',
            'phone' => '+995 555 150 150',
            'role' => UserRole::Supervisor,
            'password' => 'password',
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
        $supervisor->assignRole('supervisor');

        $users = [
            [
                'name' => 'Giorgi Kapanadze',
                'email' => 'admin@bsc.ge',
                'phone' => '+995 555 100 100',
                'role' => UserRole::Admin,
                'spatie_role' => 'admin',
            ],
            [
                'name' => 'Nino Beridze',
                'email' => 'nino@bsc.ge',
                'phone' => '+995 555 200 200',
                'role' => UserRole::SalesRep,
                'spatie_role' => 'sales_rep',
                'id_gvari' => 4339, // provided: FMG IdGvari for Nino
                'supervisor_id' => $supervisor->id,
            ],
            [
                'name' => 'Davit Gelashvili',
                'email' => 'davit@bsc.ge',
                'phone' => '+995 555 300 300',
                'role' => UserRole::SalesRep,
                'spatie_role' => 'sales_rep',
            ],
            [
                'name' => 'Levan Tsiklauri',
                'email' => 'levan@bsc.ge',
                'phone' => '+995 555 400 400',
                'role' => UserRole::Warehouse,
                'spatie_role' => 'warehouse',
            ],
            [
                'name' => 'Tornike Lomidze',
                'email' => 'tornike@bsc.ge',
                'phone' => '+995 555 500 500',
                'role' => UserRole::Driver,
                'spatie_role' => 'driver',
            ],
        ];

        foreach ($users as $userData) {
            $spatieRole = $userData['spatie_role'];
            unset($userData['spatie_role']);

            $user = User::create(array_merge($userData, [
                'password' => 'password',
                'is_active' => true,
                'email_verified_at' => now(),
            ]));

            $user->assignRole($spatieRole);
        }
    }
}
