<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PreferTokenGuardForApiRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        $hasBearerToken = trim((string) $request->bearerToken()) !== '';
        $hasAdminTokenHeader = trim((string) $request->header('x-admin-token', '')) !== '';

        if ($hasBearerToken || $hasAdminTokenHeader) {
            config(['sanctum.guard' => []]);
        }

        return $next($request);
    }
}