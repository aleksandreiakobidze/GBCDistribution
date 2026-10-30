<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('field_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('require_photo_before')->default(false);
            $table->boolean('require_photo_end')->default(false);
            $table->boolean('require_photo_shelf')->default(false);
            $table->boolean('require_survey')->default(false);
            $table->boolean('require_shelf_audit')->default(false);
            $table->boolean('require_gps')->default(false);
            $table->boolean('missed_skips_rules')->default(true);
            $table->timestamps();
        });

        DB::table('field_settings')->insert([
            'require_photo_before' => false,
            'require_photo_end' => false,
            'require_photo_shelf' => false,
            'require_survey' => false,
            'require_shelf_audit' => false,
            'require_gps' => false,
            'missed_skips_rules' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('field_settings');
    }
};
