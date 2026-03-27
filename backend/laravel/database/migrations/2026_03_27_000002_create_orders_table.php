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
            $table->string('order_number')->unique();
            $table->json('user_info');
            $table->string('customer_email')->index();
            $table->decimal('total_price', 12, 2);
            $table->string('status')->index();
            $table->string('payment_status')->default('unpaid')->index();
            $table->string('payment_currency', 8)->default('XOF');
            $table->string('shipping_method', 20);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
