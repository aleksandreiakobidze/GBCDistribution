<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('erp_collections', function (Blueprint $table) {
            $table->string('customer_name', 255)->nullable()->after('customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('erp_collections', function (Blueprint $table) {
            $table->dropColumn('customer_name');
        });
    }
};
