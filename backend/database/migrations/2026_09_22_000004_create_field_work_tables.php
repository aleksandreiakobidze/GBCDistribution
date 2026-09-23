<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('id_gvari');
            $table->string('customer_id', 32)->nullable();
            $table->string('customer_name')->nullable();
            $table->foreignId('photo_id')->nullable()->constrained('erp_visit_photos')->nullOnDelete();
            $table->string('title', 160);
            $table->string('note', 300)->nullable();
            $table->date('due_on')->nullable();
            $table->string('status', 16);
            $table->dateTime('completed_at')->nullable();
            $table->foreignId('checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('checked_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'customer_id', 'status']);
        });

        Schema::create('erp_visit_surveys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->unique()->constrained('erp_visits')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('id_gvari');
            $table->string('customer_id', 32);
            $table->string('customer_name')->nullable();
            $table->boolean('shelf_stocked');
            $table->boolean('price_visible');
            $table->boolean('promo_present');
            $table->boolean('competitor_seen');
            $table->timestamps();
        });

        Schema::create('erp_visit_coaching', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->unique()->constrained('erp_visits')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supervisor_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->string('note', 300)->nullable();
            $table->timestamps();
        });

        Schema::create('erp_shelf_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('id_gvari');
            $table->string('customer_id', 32);
            $table->string('customer_name')->nullable();
            $table->foreignId('visit_id')->nullable()->constrained('erp_visits')->nullOnDelete();
            $table->foreignId('photo_id')->nullable()->constrained('erp_visit_photos')->nullOnDelete();
            $table->timestamps();
            $table->index(['user_id', 'customer_id']);
        });

        Schema::create('erp_shelf_audit_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_id')->constrained('erp_shelf_audits')->cascadeOnDelete();
            $table->string('item_id', 32);
            $table->string('item_name')->nullable();
            $table->string('status', 16);
            $table->unique(['audit_id', 'item_id']);
        });

        Schema::create('erp_promo_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('id_gvari');
            $table->string('customer_id', 32)->nullable();
            $table->string('customer_name')->nullable();
            $table->string('title', 160);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('status', 16);
            $table->foreignId('photo_id')->nullable()->constrained('erp_visit_photos')->nullOnDelete();
            $table->string('note', 300)->nullable();
            $table->timestamps();
            $table->index(['user_id', 'starts_on', 'ends_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_promo_plans');
        Schema::dropIfExists('erp_shelf_audit_lines');
        Schema::dropIfExists('erp_shelf_audits');
        Schema::dropIfExists('erp_visit_coaching');
        Schema::dropIfExists('erp_visit_surveys');
        Schema::dropIfExists('erp_tasks');
    }
};
