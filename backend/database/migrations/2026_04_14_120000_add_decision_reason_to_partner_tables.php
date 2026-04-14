<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_partner_requests', function (Blueprint $table) {
            $table->text('decision_reason')->nullable()->after('status');
            $table->timestamp('reviewed_at')->nullable()->after('decision_reason');
        });

        Schema::table('api_partners', function (Blueprint $table) {
            $table->text('deactivated_reason')->nullable()->after('is_active');
            $table->timestamp('deactivated_at')->nullable()->after('deactivated_reason');
        });
    }

    public function down(): void
    {
        Schema::table('api_partners', function (Blueprint $table) {
            $table->dropColumn(['deactivated_reason', 'deactivated_at']);
        });

        Schema::table('api_partner_requests', function (Blueprint $table) {
            $table->dropColumn(['decision_reason', 'reviewed_at']);
        });
    }
};