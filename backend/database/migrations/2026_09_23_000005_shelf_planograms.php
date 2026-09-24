<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_planogram_lines', function (Blueprint $table) {
            $table->id();
            $table->string('customer_id', 32)->nullable();
            $table->unsignedInteger('org_category_id')->nullable();
            $table->unsignedTinyInteger('shelf_no');
            $table->unsignedSmallInteger('position');
            $table->string('item_id', 32);
            $table->string('item_name')->nullable();
            $table->unsignedTinyInteger('facings')->default(1);
            $table->decimal('target_price', 12, 4)->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->index('customer_id');
            $table->index('org_category_id');
        });

        Schema::table('erp_shelf_audit_lines', function (Blueprint $table) {
            $table->unsignedTinyInteger('shelf_no')->nullable();
            $table->unsignedTinyInteger('facings')->default(1);
            $table->decimal('read_price', 12, 4)->nullable();
            $table->decimal('box_x', 6, 4)->nullable();
            $table->decimal('box_y', 6, 4)->nullable();
            $table->decimal('box_w', 6, 4)->nullable();
            $table->decimal('box_h', 6, 4)->nullable();
            $table->boolean('competitor')->default(false);
            $table->dropUnique(['audit_id', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::table('erp_shelf_audit_lines', function (Blueprint $table) {
            $table->dropColumn([
                'shelf_no', 'facings', 'read_price', 'box_x', 'box_y', 'box_w', 'box_h', 'competitor',
            ]);
            $table->unique(['audit_id', 'item_id']);
        });

        Schema::dropIfExists('erp_planogram_lines');
    }
};
