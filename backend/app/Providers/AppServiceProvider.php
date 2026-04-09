<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Sanctum::getAccessTokenFromRequestUsing(function (Request $request): ?string {
            $bearerToken = trim((string) $request->bearerToken());
            if ($bearerToken !== '') {
                return $bearerToken;
            }

            $adminToken = trim((string) $request->header('x-admin-token', ''));
            if ($adminToken === '') {
                return null;
            }

            if (str_starts_with(strtolower($adminToken), 'bearer ')) {
                $adminToken = trim(substr($adminToken, 7));
            }

            return $adminToken !== '' ? $adminToken : null;
        });

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute((int) env('API_RATE_LIMIT', 120))
                ->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('payments', function (Request $request) {
            return Limit::perMinute((int) env('PAYMENT_RATE_LIMIT', 30))
                ->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('partner-api', function (Request $request) {
            $partner = $request->attributes->get('api_partner');
            $key = $partner?->app_key ?: $request->header('X-APP-KEY') ?: $request->ip();

            return Limit::perMinute((int) env('PARTNER_API_RATE_LIMIT', 60))
                ->by((string) $key);
        });
    }
}
