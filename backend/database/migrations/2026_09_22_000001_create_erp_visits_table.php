<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('id_gvari');
            $table->string('customer_id', 32);
            $table->string('customer_name')->nullable();
            $table->string('status', 16);
            $table->dateTime('started_at');
            $table->dateTime('ended_at')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'customer_id', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_visits');
    }
};
