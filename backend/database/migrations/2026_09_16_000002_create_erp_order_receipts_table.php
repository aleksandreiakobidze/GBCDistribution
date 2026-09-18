<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_order_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 32);
            $table->string('company', 64);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('external_id');
            $table->string('payload_hash', 64);
            $table->string('customer_id', 32);
            $table->unsignedSmallInteger('id_gvari');
            $table->string('quote_id', 64)->nullable();
            $table->string('erp_order_id', 32)->nullable();
            $table->string('status', 32);
            $table->json('result_json')->nullable();
            $table->timestamps();

            $table->unique(
                ['provider', 'company', 'user_id', 'external_id'],
                'erp_receipts_idempotency_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_order_receipts');
    }
};
