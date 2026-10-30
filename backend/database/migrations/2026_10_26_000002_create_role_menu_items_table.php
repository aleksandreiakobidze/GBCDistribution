<?php

use App\Erp\Support\RoleMenus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_menu_items', function (Blueprint $table) {
            $table->id();
            $table->string('role_name', 64);
            $table->string('menu_key', 32);
            $table->unique(['role_name', 'menu_key']);
        });

        RoleMenus::seed();
    }

    public function down(): void
    {
        Schema::dropIfExists('role_menu_items');
    }
};
