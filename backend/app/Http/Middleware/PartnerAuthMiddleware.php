<?php

namespace App\Http\Middleware;

use App\Services\PartnerService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PartnerAuthMiddleware
{
    public function __construct(
        protected PartnerService $partners,
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        try {
            $partner = $this->partners->authenticateRequest($request);
        } catch (\Throwable $exception) {
            return new JsonResponse([
                'error' => true,
                'message' => $exception->getMessage() ?: 'Authentification partner invalide.',
            ], 401);
        }

        $request->attributes->set('api_partner', $partner);

        return $next($request);
    }
}