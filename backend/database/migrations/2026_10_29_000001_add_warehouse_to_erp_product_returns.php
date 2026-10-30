<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('erp_product_returns', function (Blueprint $table) {
            $table->string('warehouse_id', 32)->nullable()->after('customer_name');
            $table->string('warehouse_name')->nullable()->after('warehouse_id');
        });
    }

    public function down(): void
    {
        Schema::table('erp_product_returns', function (Blueprint $table) {
            $table->dropColumn(['warehouse_id', 'warehouse_name']);
        });
    }
};
