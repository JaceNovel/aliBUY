<?php

use App\Http\Controllers\AccountAddressController;
use App\Http\Controllers\AccountProfileController;
use App\Http\Controllers\AccountSecurityController;
use App\Http\Controllers\AccountSettingsController;
use App\Http\Controllers\AdminDiagnosticsController;
use App\Http\Controllers\AlibabaAdminController;
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
use App\Http\Controllers\PartnerAdminController;
use App\Http\Controllers\PartnerDocsController;
use App\Http\Controllers\PartnerPortalController;
use App\Http\Controllers\PartnerOrderAdminController;
use App\Http\Controllers\PartnerOrderController;
use App\Http\Controllers\PartnerProductController;
use App\Http\Controllers\PartnerRequestController;
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
Route::get('/docs', [PartnerDocsController::class, 'show']);
Route::get('/search-suggestions', [SearchSuggestionController::class, 'index']);
Route::get('/pricing-context', [PricingContextController::class, 'show']);
Route::post('/promo-codes/preview', [PromoCodeController::class, 'preview']);
Route::get('/favorites', [FavoriteController::class, 'show']);
Route::post('/alibaba-sourcing/quote', [SourcingQuoteController::class, 'quote']);
Route::post('/payment/webhook', [PaymentController::class, 'webhook']);
Route::post('/image-search', [ImageSearchController::class, 'search']);
Route::post('/location/reverse-geocode', [LocationController::class, 'reverseGeocode']);
Route::post('/location/resolve-maps-link', [LocationController::class, 'resolveMapsLink']);
Route::get('/free-deals/state', [FreeDealController::class, 'state']);
Route::post('/free-deals/checkout', [FreeDealController::class, 'checkout']);
Route::post('/free-deals/verify-payment', [FreeDealController::class, 'verifyPayment']);
Route::post('/partner/request', [PartnerRequestController::class, 'store']);
Route::prefix('partner/portal')->group(function () {
    Route::get('/access', [PartnerPortalController::class, 'access']);
    Route::get('/stats', [PartnerPortalController::class, 'stats']);
    Route::get('/orders', [PartnerPortalController::class, 'orders']);
    Route::get('/wallet', [PartnerPortalController::class, 'wallet']);
    Route::get('/withdrawals', [PartnerPortalController::class, 'withdrawals']);
    Route::post('/withdrawals', [PartnerPortalController::class, 'requestWithdrawal']);
    Route::get('/keys', [PartnerPortalController::class, 'keys']);
    Route::post('/keys/regenerate', [PartnerPortalController::class, 'regenerateKeys']);
    Route::get('/approval-guide', [PartnerPortalController::class, 'approvalGuide']);
    Route::get('/charter', [PartnerPortalController::class, 'charter']);
});
Route::get('/admin/alibaba/supplier-accounts/oauth/callback', [AlibabaAdminController::class, 'oauthCallback']);

Route::prefix('partner')
    ->middleware(['partner.api.log', 'partner.auth', 'throttle:partner-api'])
    ->group(function () {
        Route::get('/products', [PartnerProductController::class, 'index']);
        Route::get('/orders', [PartnerOrderController::class, 'index']);
        Route::get('/orders/{id}', [PartnerOrderController::class, 'show']);
        Route::post('/orders', [PartnerOrderController::class, 'store']);
        Route::get('/balance', [PartnerOrderController::class, 'balance']);
    });

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
Route::get('/products/{product}/reviews', [ProductController::class, 'reviews']);
Route::post('/products/{product}/reviews', [ProductController::class, 'storeReview']);
Route::post('/products/{product}/review-media', [ProductController::class, 'uploadReviewMedia']);
Route::post('/products/{product}/view', [ProductController::class, 'trackView']);
Route::apiResource('products', ProductController::class)->only(['index', 'show']);
Route::middleware('auth:sanctum')->apiResource('products', ProductController::class)->only(['store', 'update', 'destroy']);

Route::get('/catalog/products', [ProductController::class, 'index']);
Route::get('/catalog/categories', [ProductController::class, 'categories']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/admin/alibaba/dashboard', [AlibabaAdminController::class, 'dashboard']);
    Route::post('/admin/alibaba/search', [AlibabaAdminController::class, 'search']);
    Route::post('/admin/alibaba/fetch-remote', [AlibabaAdminController::class, 'fetchRemote']);
    Route::post('/admin/alibaba/probe', [AlibabaAdminController::class, 'probe']);
    Route::post('/admin/alibaba/import', [AlibabaAdminController::class, 'import']);
    Route::delete('/admin/alibaba/import', [AlibabaAdminController::class, 'purgeImports']);
    Route::post('/admin/alibaba/import/reenrich', [AlibabaAdminController::class, 'reenrichAllImports']);
    Route::delete('/admin/alibaba/import/{importedProductId}', [AlibabaAdminController::class, 'deleteImport']);
    Route::post('/admin/alibaba/import/{importedProductId}/reenrich', [AlibabaAdminController::class, 'reenrichImport']);
    Route::post('/admin/alibaba/supplier-accounts', [AlibabaAdminController::class, 'supplierAccounts']);
    Route::match(['GET', 'POST'], '/admin/alibaba/supplier-accounts/oauth/start', [AlibabaAdminController::class, 'oauthStart']);
    Route::post('/admin/alibaba/supplier-accounts/{accountId}/refresh', [AlibabaAdminController::class, 'refreshSupplierAccount']);
    Route::post('/admin/alibaba/reception-addresses', [AlibabaAdminController::class, 'receptionAddresses']);
    Route::put('/admin/alibaba/country-profiles', [AlibabaAdminController::class, 'countryProfiles']);
    Route::post('/admin/alibaba/publish', [AlibabaAdminController::class, 'publish']);
    Route::post('/admin/alibaba/purchase-orders', [AlibabaAdminController::class, 'purchaseOrders']);
    Route::post('/admin/alibaba/purchase-orders/{orderId}/pay', [AlibabaAdminController::class, 'payPurchaseOrder']);
    Route::get('/admin/diagnostics/manychat', [AdminDiagnosticsController::class, 'manychat']);
    Route::get('/admin/free-deals', [FreeDealController::class, 'adminShow']);
    Route::put('/admin/free-deals', [FreeDealController::class, 'adminSave']);
    Route::post('/admin/free-deals', [FreeDealController::class, 'adminImport']);
    Route::get('/admin/partner-requests', [PartnerAdminController::class, 'index']);
    Route::post('/admin/partner-requests/{apiPartnerRequest}/approve', [PartnerAdminController::class, 'approve']);
    Route::post('/admin/partner-requests/{apiPartnerRequest}/reject', [PartnerAdminController::class, 'reject']);
    Route::post('/admin/partner-requests/{apiPartnerRequest}/block', [PartnerAdminController::class, 'block']);
    Route::post('/admin/partner-requests/{apiPartnerRequest}/reactivate', [PartnerAdminController::class, 'reactivate']);
    Route::get('/admin/partner-withdrawals', [PartnerAdminController::class, 'withdrawals']);
    Route::post('/admin/partner-withdrawals/{partnerWithdrawal}/approve', [PartnerAdminController::class, 'approveWithdrawal']);
    Route::post('/admin/partner-withdrawals/{partnerWithdrawal}/reject', [PartnerAdminController::class, 'rejectWithdrawal']);
    Route::patch('/admin/partner-orders/{order}/status', [PartnerOrderAdminController::class, 'updateStatus']);
    Route::get('/admin/orders', [OrderController::class, 'adminIndex']);
    Route::get('/admin/orders/{order}', [OrderController::class, 'adminShow']);
    Route::patch('/admin/sourcing/orders/{order}', [OrderController::class, 'adminUpdateSourcing']);
    Route::post('/admin/sourcing/orders/{order}/delivery-note', [OrderController::class, 'adminRegisterDeliveryNoteExport']);
    Route::get('/admin/users', [UserController::class, 'adminIndex']);
    Route::get('/admin/users/{user}', [UserController::class, 'adminShow']);
    Route::apiResource('orders', OrderController::class)->only(['index', 'store', 'show']);
    Route::post('/orders/{order}/promo', [OrderController::class, 'applyPromo']);
});

Route::prefix('payments')->group(function () {
    Route::middleware(['auth:sanctum', 'throttle:payments'])->group(function () {
        Route::post('/init', [PaymentController::class, 'init']);
        Route::post('/verify', [PaymentController::class, 'verify']);
        Route::post('/moneroo/initialize', [PaymentController::class, 'init']);
        Route::post('/moneroo/verify', [PaymentController::class, 'verify']);
        Route::post('/paypal/proxy/init', [PaymentController::class, 'proxyPayPalInit']);
        Route::post('/paypal/proxy/verify', [PaymentController::class, 'proxyPayPalVerify']);
    });
    Route::post('/webhook', [PaymentController::class, 'webhook']);
    Route::post('/moneroo/webhook', [PaymentController::class, 'monerooWebhook']);
    Route::post('/paypal/webhook', [PaymentController::class, 'paypalWebhook']);
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
