<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_product_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('id_gvari');
            $table->string('customer_id', 32);
            $table->string('note', 300)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'id_gvari', 'customer_id']);
        });

        Schema::create('erp_product_return_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('erp_product_return_id')->constrained('erp_product_returns')->cascadeOnDelete();
            $table->string('item_id', 32);
            $table->string('item_name', 255)->nullable();
            $table->decimal('quantity', 12, 4);
            $table->string('reason', 32);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_product_return_lines');
        Schema::dropIfExists('erp_product_returns');
    }
};
