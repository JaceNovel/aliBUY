<?php

use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

Route::prefix('products')->group(function () {
    Route::get('/', [ProductController::class, 'index']);
    Route::get('/featured', [ProductController::class, 'featured']);
    Route::get('/search', [ProductController::class, 'search']);
    Route::get('/categories', [ProductController::class, 'categories']);
    Route::get('/categories/{slug}', [ProductController::class, 'category']);
    Route::get('/{product:slug}', [ProductController::class, 'show']);
    Route::get('/{product:slug}/related', [ProductController::class, 'related']);
    Route::post('/{product:slug}/view', [ProductController::class, 'trackView']);
    Route::post('/', [ProductController::class, 'store']);
    Route::put('/{product:slug}', [ProductController::class, 'update']);
    Route::delete('/{product:slug}', [ProductController::class, 'destroy']);
});

Route::prefix('orders')->group(function () {
    Route::get('/', [OrderController::class, 'index']);
    Route::post('/', [OrderController::class, 'store']);
    Route::get('/{order}', [OrderController::class, 'show']);
    Route::post('/{order}/promo', [OrderController::class, 'applyPromo']);
});

Route::prefix('payments')->group(function () {
    Route::post('/init', [PaymentController::class, 'init']);
    Route::post('/verify', [PaymentController::class, 'verify']);
    Route::post('/webhook', [PaymentController::class, 'webhook']);
});
