<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monitoring_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sales_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('sales_name')->default('');
            $table->string('id_org');
            $table->string('org_name');
            $table->decimal('system_debt', 16, 4);
            $table->decimal('actual_debt', 16, 4);
            $table->timestamps();
            $table->index(['user_id', 'id']);
        });

        Schema::create('monitoring_order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('monitoring_order_id')->constrained('monitoring_orders')->cascadeOnDelete();
            $table->string('source');
            $table->string('id_prod')->nullable();
            $table->string('name');
            $table->decimal('system_qty', 16, 4)->nullable();
            $table->decimal('actual_qty', 16, 4);
            $table->unsignedInteger('sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monitoring_order_lines');
        Schema::dropIfExists('monitoring_orders');
    }
};
