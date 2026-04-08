<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('order_number')->unique();
            $table->string('customer_name');
            $table->string('customer_email')->index();
            $table->string('customer_phone', 50)->nullable();
            $table->json('user_info')->nullable();
            $table->string('address_line1')->nullable();
            $table->string('address_line2')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('postal_code', 40)->nullable();
            $table->string('country_code', 2)->default('CI')->index();
            $table->json('items');
            $table->decimal('total_price', 12, 2);
            $table->string('status')->index();
            $table->string('payment_status')->default('unpaid')->index();
            $table->string('payment_currency', 8)->default('XOF');
            $table->string('payment_provider', 30)->default('moneroo')->index();
            $table->string('payment_reference')->nullable()->index();
            $table->text('payment_checkout_url')->nullable();
            $table->json('payment_provider_payload')->nullable();
            $table->string('shipping_method', 20);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['customer_email', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
