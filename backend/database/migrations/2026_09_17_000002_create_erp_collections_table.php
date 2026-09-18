<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_collections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('id_gvari');
            $table->string('customer_id', 32);
            $table->decimal('amount', 12, 2);
            $table->string('method', 16)->default('cash');
            $table->string('note', 300)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'id_gvari', 'customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_collections');
    }
};
