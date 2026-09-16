<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_quotes', function (Blueprint $table) {
            $table->id();
            $table->uuid('quote_id')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('customer_id', 32);
            $table->string('payload_hash', 64);
            $table->json('quote_json');
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_quotes');
    }
};
