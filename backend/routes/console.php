<?php

use App\Models\Product;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('catalog:purge-products {--force : Skip the confirmation prompt}', function () {
    if (! $this->option('force') && ! $this->confirm('Delete all products from the catalog?')) {
        $this->warn('Catalog purge cancelled.');

        return 1;
    }

    $count = Product::query()->count();

    if ($count === 0) {
        $this->info('No catalog products to delete.');

        return 0;
    }

    Product::query()->delete();

    $this->info("Deleted {$count} catalog products.");

    return 0;
})->purpose('Delete every catalog product record');
