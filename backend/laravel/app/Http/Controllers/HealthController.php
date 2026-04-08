<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function ping(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'service' => 'afripay-laravel-api',
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    public function legacy(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'service' => 'backend',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}