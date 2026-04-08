<?php

use App\Http\Controllers\AccountAddressController;
use App\Http\Controllers\AccountProfileController;
use App\Http\Controllers\AccountSecurityController;
use App\Http\Controllers\AccountSettingsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\FavoriteController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PricingContextController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PromoCodeController;
use App\Http\Controllers\SearchSuggestionController;
use App\Http\Controllers\SourcingQuoteController;
use App\Http\Controllers\QuoteController;
use App\Http\Controllers\SupportController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/test/ping', [HealthController::class, 'ping']);
Route::get('/health', [HealthController::class, 'legacy']);
Route::get('/search-suggestions', [SearchSuggestionController::class, 'index']);
Route::get('/pricing-context', [PricingContextController::class, 'show']);
Route::post('/promo-codes/preview', [PromoCodeController::class, 'preview']);
Route::get('/favorites', [FavoriteController::class, 'show']);
Route::post('/aliexpress-sourcing/quote', [SourcingQuoteController::class, 'quote']);

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);
});

Route::prefix('products')->group(function () {
    Route::get('/', [ProductController::class, 'index']);
    Route::get('/featured', [ProductController::class, 'featured']);
    Route::get('/search', [ProductController::class, 'search']);
    Route::get('/category', [ProductController::class, 'categoryFeed']);
    Route::get('/categories', [ProductController::class, 'categories']);
    Route::get('/categories/{slug}', [ProductController::class, 'category']);
    Route::get('/{product:slug}', [ProductController::class, 'show']);
    Route::get('/{product:slug}/related', [ProductController::class, 'related']);
    Route::post('/{product:slug}/view', [ProductController::class, 'trackView']);
    Route::post('/', [ProductController::class, 'store']);
    Route::put('/{product:slug}', [ProductController::class, 'update']);
    Route::delete('/{product:slug}', [ProductController::class, 'destroy']);
});

Route::get('/catalog/products', [ProductController::class, 'index']);
Route::get('/catalog/categories', [ProductController::class, 'categories']);

Route::prefix('orders')->group(function () {
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/', [OrderController::class, 'index']);
        Route::post('/', [OrderController::class, 'store']);
        Route::get('/{order}', [OrderController::class, 'show']);
        Route::post('/{order}/promo', [OrderController::class, 'applyPromo']);
    });
});

Route::prefix('payments')->group(function () {
    Route::middleware(['auth:sanctum', 'throttle:payments'])->group(function () {
        Route::post('/init', [PaymentController::class, 'init']);
        Route::post('/verify', [PaymentController::class, 'verify']);
        Route::post('/moneroo/initialize', [PaymentController::class, 'init']);
        Route::post('/moneroo/verify', [PaymentController::class, 'verify']);
    });
    Route::post('/webhook', [PaymentController::class, 'webhook']);
    Route::post('/moneroo/webhook', [PaymentController::class, 'monerooWebhook']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/cart/activity', [CartController::class, 'syncActivity']);
    Route::post('/cart/shares', [CartController::class, 'createShare']);
    Route::post('/cart/shares/{token}/claim', [CartController::class, 'claimShare']);
    Route::post('/favorites', [FavoriteController::class, 'toggle']);
    Route::post('/quotes', [QuoteController::class, 'store']);
    Route::post('/quotes/draft', [QuoteController::class, 'syncDraft']);
    Route::get('/messages', [MessageController::class, 'index']);
    Route::post('/messages', [MessageController::class, 'store']);
    Route::post('/support/quick-start', [SupportController::class, 'quickStart']);
    Route::get('/users', [UserController::class, 'me']);
    Route::get('/users/me', [UserController::class, 'me']);
    Route::get('/account/session', [UserController::class, 'me']);
    Route::get('/account/settings', [AccountSettingsController::class, 'show']);
    Route::patch('/account/settings', [AccountSettingsController::class, 'update']);
    Route::post('/account/change-email', [AccountSecurityController::class, 'changeEmail']);
    Route::post('/account/change-password', [AccountSecurityController::class, 'changePassword']);
    Route::post('/account/delete', [AccountSecurityController::class, 'delete']);
    Route::post('/account/profile-photo', [AccountProfileController::class, 'uploadPhoto']);
    Route::get('/account/addresses', [AccountAddressController::class, 'index']);
    Route::post('/account/addresses', [AccountAddressController::class, 'store']);
    Route::put('/account/addresses/{address}', [AccountAddressController::class, 'update']);
    Route::patch('/account/addresses/{address}', [AccountAddressController::class, 'setDefault']);
    Route::delete('/account/addresses/{address}', [AccountAddressController::class, 'destroy']);
});
