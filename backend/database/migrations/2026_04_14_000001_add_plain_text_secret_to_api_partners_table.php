<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('api_partners') || Schema::hasColumn('api_partners', 'plain_text_secret')) {
            return;
        }

        Schema::table('api_partners', function (Blueprint $table) {
            $table->text('plain_text_secret')->nullable()->after('app_secret');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('api_partners') || ! Schema::hasColumn('api_partners', 'plain_text_secret')) {
            return;
        }

        Schema::table('api_partners', function (Blueprint $table) {
            $table->dropColumn('plain_text_secret');
        });
    }
};
