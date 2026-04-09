<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InjectAdminTokenHeader
{
    public function handle(Request $request, Closure $next): Response
    {
        $authorization = trim((string) $request->headers->get('authorization', ''));
        $adminToken = trim((string) $request->headers->get('x-admin-token', ''));

        if ($authorization === '' && $adminToken !== '') {
            $bearerToken = str_starts_with(strtolower($adminToken), 'bearer ')
                ? $adminToken
                : 'Bearer '.$adminToken;

            $request->headers->set('authorization', $bearerToken);
            $request->server->set('HTTP_AUTHORIZATION', $bearerToken);
            $request->server->set('REDIRECT_HTTP_AUTHORIZATION', $bearerToken);
        }

        return $next($request);
    }
}