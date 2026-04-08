<?php

use App\Http\Controllers\AccountAddressController;
use App\Http\Controllers\AccountProfileController;
use App\Http\Controllers\AccountSecurityController;
use App\Http\Controllers\AccountSettingsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\FavoriteController;
use App\Http\Controllers\FreeDealController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\ImageSearchController;
use App\Http\Controllers\LocationController;
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
Route::post('/payment/webhook', [PaymentController::class, 'webhook']);
Route::post('/image-search', [ImageSearchController::class, 'search']);
Route::post('/location/reverse-geocode', [LocationController::class, 'reverseGeocode']);
Route::post('/location/resolve-maps-link', [LocationController::class, 'resolveMapsLink']);
Route::get('/free-deals/state', [FreeDealController::class, 'state']);
Route::post('/free-deals/checkout', [FreeDealController::class, 'checkout']);

Route::prefix('auth')->group(function () {
    Route::post('/admin-login', [AuthController::class, 'adminLogin']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);
});

Route::get('/products/featured', [ProductController::class, 'featured']);
Route::get('/products/search', [ProductController::class, 'search']);
Route::get('/products/category', [ProductController::class, 'categoryFeed']);
Route::get('/products/categories', [ProductController::class, 'categories']);
Route::get('/products/categories/{slug}', [ProductController::class, 'category']);
Route::get('/products/{product}/related', [ProductController::class, 'related']);
Route::post('/products/{product}/view', [ProductController::class, 'trackView']);
Route::apiResource('products', ProductController::class)->only(['index', 'show']);
Route::middleware('auth:sanctum')->apiResource('products', ProductController::class)->only(['store', 'update', 'destroy']);

Route::get('/catalog/products', [ProductController::class, 'index']);
Route::get('/catalog/categories', [ProductController::class, 'categories']);

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('orders', OrderController::class)->only(['index', 'store', 'show']);
    Route::post('/orders/{order}/promo', [OrderController::class, 'applyPromo']);
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
    Route::post('/payment/init', [PaymentController::class, 'init'])->middleware('throttle:payments');
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
