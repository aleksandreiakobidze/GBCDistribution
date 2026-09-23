<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('erp_visit_photos', function (Blueprint $table) {
            $table->string('signature', 300)->nullable()->after('comment');
            $table->string('review_comment', 300)->nullable()->after('signature');
            $table->unsignedTinyInteger('rating')->nullable()->after('review_comment');
            $table->unsignedSmallInteger('rotation')->default(0)->after('rating');
            $table->dateTime('reviewed_at')->nullable()->after('rotation');
            $table->foreignId('reviewed_by')->nullable()->after('reviewed_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('erp_visit_photos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropColumn(['signature', 'review_comment', 'rating', 'rotation', 'reviewed_at']);
        });
    }
};
