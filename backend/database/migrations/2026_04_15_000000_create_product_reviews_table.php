<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source', 30)->default('customer')->index();
            $table->string('source_review_id')->nullable()->index();
            $table->string('reviewer_name');
            $table->string('reviewer_email')->nullable()->index();
            $table->unsignedTinyInteger('rating');
            $table->string('title')->nullable();
            $table->text('comment');
            $table->json('media_urls')->nullable();
            $table->boolean('verified_purchase')->default(false)->index();
            $table->string('status', 30)->default('published')->index();
            $table->timestamp('submitted_at')->nullable()->index();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'order_id', 'source']);
            $table->index(['product_id', 'status', 'submitted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_reviews');
    }
};