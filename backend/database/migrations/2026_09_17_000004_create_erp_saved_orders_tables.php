<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('erp_product_returns', function (Blueprint $table) {
            $table->string('customer_name', 255)->nullable()->after('customer_id');
        });

        Schema::create('erp_saved_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('id_gvari');
            $table->string('customer_id', 32);
            $table->string('customer_name', 255)->nullable();
            $table->decimal('total', 12, 2);
            $table->string('note', 300)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'id_gvari']);
        });

        Schema::create('erp_saved_order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('erp_saved_order_id')->constrained('erp_saved_orders')->cascadeOnDelete();
            $table->string('item_id', 32);
            $table->string('item_name', 255)->nullable();
            $table->decimal('pack_quantity', 12, 4);
            $table->decimal('pieces', 12, 4);
            $table->decimal('unit_price', 12, 4);
            $table->decimal('line_total', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_saved_order_lines');
        Schema::dropIfExists('erp_saved_orders');

        Schema::table('erp_product_returns', function (Blueprint $table) {
            $table->dropColumn('customer_name');
        });
    }
};
