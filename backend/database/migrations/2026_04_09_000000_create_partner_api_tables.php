<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_partner_requests', function (Blueprint $table) {
            $table->id();
            $table->string('company_name');
            $table->string('website')->nullable();
            $table->string('email')->index();
            $table->text('description');
            $table->string('status', 20)->default('pending')->index();
            $table->timestamps();
        });

        Schema::create('api_partners', function (Blueprint $table) {
            $table->id();
            $table->string('company_name');
            $table->string('email')->index();
            $table->string('app_key')->unique();
            $table->string('app_secret');
            $table->text('plain_text_secret')->nullable();
            $table->text('webhook_url')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('partner_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->unique()->constrained('api_partners')->cascadeOnDelete();
            $table->decimal('balance', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('partner_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('api_partners')->cascadeOnDelete();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('margin', 12, 2);
            $table->decimal('selling_price', 12, 2);
            $table->string('status', 30)->default('payment_pending')->index();
            $table->timestamps();

            $table->index(['partner_id', 'created_at']);
        });

        Schema::create('partner_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('api_partners')->cascadeOnDelete();
            $table->foreignId('partner_order_id')->nullable()->unique()->constrained('partner_orders')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('type', 20)->index();
            $table->string('description');
            $table->timestamps();

            $table->index(['partner_id', 'created_at']);
        });

        Schema::create('api_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->nullable()->constrained('api_partners')->nullOnDelete();
            $table->string('endpoint');
            $table->string('method', 12);
            $table->string('ip', 45)->nullable();
            $table->unsignedSmallInteger('status_code')->default(200)->index();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['partner_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_logs');
        Schema::dropIfExists('partner_transactions');
        Schema::dropIfExists('partner_orders');
        Schema::dropIfExists('partner_wallets');
        Schema::dropIfExists('api_partners');
        Schema::dropIfExists('api_partner_requests');
    }
};