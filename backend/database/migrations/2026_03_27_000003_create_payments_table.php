<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('provider')->default('moneroo');
            $table->string('status')->index();
            $table->string('transaction_id')->nullable()->index();
            $table->string('provider_reference')->nullable()->index();
            $table->string('checkout_url')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['provider', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
