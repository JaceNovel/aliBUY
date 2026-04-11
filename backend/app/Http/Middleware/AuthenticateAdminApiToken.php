<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateAdminApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $configuredToken = trim((string) env('ADMIN_API_TOKEN', ''));
        if ($configuredToken === '') {
            return $next($request);
        }

        $submittedToken = trim((string) $request->header('x-admin-token', ''));
        if ($submittedToken === '') {
            $submittedToken = trim((string) $request->bearerToken());
        }

        if ($submittedToken === '' || ! hash_equals($configuredToken, $submittedToken)) {
            return $next($request);
        }

        $adminEmail = strtolower(trim((string) env('ADMIN_EMAIL', '')));
        if ($adminEmail === '') {
            return $next($request);
        }

        $user = User::query()->where('email', $adminEmail)->first();
        if (! $user || ! $user->hasAdminAccess()) {
            return $next($request);
        }

        Auth::shouldUse('sanctum');
        $guard = Auth::guard('sanctum');
        if (method_exists($guard, 'setUser')) {
            $guard->setUser($user);
        }

        $request->setUserResolver(static fn (?string $guardName = null) => $user);

        return $next($request);
    }
}