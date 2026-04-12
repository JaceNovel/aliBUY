<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partner_withdrawals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('api_partners')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('method', 30)->index();
            $table->string('status', 20)->default('pending')->index();
            $table->string('bank_account_name')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('iban')->nullable();
            $table->string('swift_code')->nullable();
            $table->string('mobile_money_number')->nullable();
            $table->string('mobile_money_country_code', 4)->nullable();
            $table->string('mobile_money_operator')->nullable();
            $table->text('admin_note')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['partner_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_withdrawals');
    }
};