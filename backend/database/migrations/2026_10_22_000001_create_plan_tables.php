<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plan_uploads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('original_name');
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('plan_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upload_id')->constrained('plan_uploads')->cascadeOnDelete();
            $table->string('region')->default('');
            $table->string('supervisor')->default('');
            $table->string('presale');
            $table->string('channel');
            $table->string('category');
            $table->string('brand');
            $table->decimal('plan_amount', 16, 4)->default(0);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->index('upload_id');
        });

        Schema::create('plan_facts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upload_id')->constrained('plan_uploads')->cascadeOnDelete();
            $table->string('presale_key');
            $table->string('channel_key');
            $table->string('category_key');
            $table->string('brand_key');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->decimal('real_amount', 16, 4)->default(0);
            $table->decimal('return_amount', 16, 4)->default(0);
            $table->unique(
                ['upload_id', 'presale_key', 'channel_key', 'category_key', 'brand_key', 'starts_on', 'ends_on'],
                'plan_facts_key_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_facts');
        Schema::dropIfExists('plan_lines');
        Schema::dropIfExists('plan_uploads');
    }
};
