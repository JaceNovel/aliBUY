<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'product_id')) {
                $table->foreignId('product_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
            }

            if (! Schema::hasColumn('orders', 'base_price')) {
                $table->decimal('base_price', 12, 2)->nullable()->after('items');
            }

            if (! Schema::hasColumn('orders', 'quantity')) {
                $table->unsignedInteger('quantity')->default(1)->after('base_price');
            }

            if (! Schema::hasColumn('orders', 'tracking_reference')) {
                $table->string('tracking_reference')->nullable()->after('payment_checkout_url')->index();
            }
        });

        Schema::table('partner_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('partner_orders', 'quantity')) {
                $table->unsignedInteger('quantity')->default(1)->after('selling_price');
            }
        });

        Schema::table('partner_transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('partner_transactions', 'order_id')) {
                $table->foreignId('order_id')->nullable()->after('partner_id')->constrained()->nullOnDelete();
                $table->index(['partner_id', 'order_id']);
            }
        });

        Schema::create('order_tracking', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('status', 30)->index();
            $table->string('description');
            $table->timestamps();

            $table->index(['order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_tracking');

        Schema::table('partner_transactions', function (Blueprint $table) {
            if (Schema::hasColumn('partner_transactions', 'order_id')) {
                $table->dropConstrainedForeignId('order_id');
            }
        });

        Schema::table('partner_orders', function (Blueprint $table) {
            if (Schema::hasColumn('partner_orders', 'quantity')) {
                $table->dropColumn('quantity');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'product_id')) {
                $table->dropConstrainedForeignId('product_id');
            }

            $columns = array_filter(['base_price', 'quantity', 'tracking_reference'], fn (string $column) => Schema::hasColumn('orders', $column));
            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};