<?php

namespace Database\Seeders;

use App\Models\Warehouse;
use Illuminate\Database\Seeder;

class WarehouseSeeder extends Seeder
{
    public function run(): void
    {
        Warehouse::create([
            'name'       => 'Main Warehouse Tbilisi',
            'address'    => '12 Kakheti Highway, Tbilisi',
            'is_default' => true,
        ]);

        Warehouse::create([
            'name'       => 'Secondary Warehouse Kutaisi',
            'address'    => '5 Chavchavadze St, Kutaisi',
            'is_default' => false,
        ]);
    }
}
