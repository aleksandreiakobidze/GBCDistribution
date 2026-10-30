<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plan_facts', function (Blueprint $table) {
            $table->dropUnique('plan_facts_key_unique');
        });

        Schema::table('plan_facts', function (Blueprint $table) {
            $table->string('supervisor_key')->default('')->after('presale_key');
            $table->unique(
                ['upload_id', 'presale_key', 'supervisor_key', 'channel_key', 'category_key', 'brand_key', 'starts_on', 'ends_on'],
                'plan_facts_key_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('plan_facts', function (Blueprint $table) {
            $table->dropUnique('plan_facts_key_unique');
        });

        Schema::table('plan_facts', function (Blueprint $table) {
            $table->dropColumn('supervisor_key');
            $table->unique(
                ['upload_id', 'presale_key', 'channel_key', 'category_key', 'brand_key', 'starts_on', 'ends_on'],
                'plan_facts_key_unique',
            );
        });
    }
};
