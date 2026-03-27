<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('title')->index();
            $table->string('slug')->unique();
            $table->longText('description');
            $table->decimal('price', 12, 2);
            $table->string('category')->index();
            $table->unsignedInteger('stock')->default(0);
            $table->string('image')->nullable();
            $table->json('gallery')->nullable();
            $table->string('supplier_name')->nullable();
            $table->string('supplier_location')->nullable();
            $table->unsignedInteger('moq')->nullable();
            $table->string('unit')->nullable();
            $table->string('badge')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('views_count')->default(0);
            $table->timestamps();

            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
