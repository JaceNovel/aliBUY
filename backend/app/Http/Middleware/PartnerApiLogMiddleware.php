<?php

namespace App\Http\Middleware;

use App\Models\ApiLog;
use App\Models\ApiPartner;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PartnerApiLogMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        try {
            $partner = $request->attributes->get('api_partner');
            $partnerId = $partner?->id;

            if (! $partnerId && $request->headers->has('X-APP-KEY')) {
                $partnerId = ApiPartner::query()
                    ->where('app_key', (string) $request->header('X-APP-KEY'))
                    ->value('id');
            }

            ApiLog::query()->create([
                'partner_id' => $partnerId,
                'endpoint' => '/'.$request->path(),
                'method' => $request->getMethod(),
                'ip' => $request->ip(),
                'status_code' => $response->getStatusCode(),
                'created_at' => now(),
            ]);
        } catch (\Throwable) {
            // Never block partner responses because of log persistence issues.
        }

        return $response;
    }
}