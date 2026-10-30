<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = [
            ['role_name' => 'admin', 'menu_key' => 'monitoring'],
            ['role_name' => 'supervisor', 'menu_key' => 'monitoring'],
        ];
        foreach ($now as $row) {
            $exists = DB::table('role_menu_items')
                ->where('role_name', $row['role_name'])
                ->where('menu_key', $row['menu_key'])
                ->exists();
            if (! $exists) {
                DB::table('role_menu_items')->insert($row);
            }
        }
    }

    public function down(): void
    {
        DB::table('role_menu_items')->where('menu_key', 'monitoring')->delete();
    }
};
