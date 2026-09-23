<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_visit_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('id_gvari');
            $table->string('customer_id', 32);
            $table->string('customer_name')->nullable();
            $table->foreignId('visit_id')->nullable()->constrained('erp_visits')->nullOnDelete();
            $table->string('phase', 16);
            $table->string('comment', 300)->nullable();
            $table->json('tags')->nullable();
            $table->dateTime('taken_at');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('path');
            $table->string('mime', 64);
            $table->timestamps();

            $table->index(['user_id', 'customer_id', 'taken_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_visit_photos');
    }
};
