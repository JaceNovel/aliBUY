<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminDiagnosticsController extends Controller
{
    public function manychat(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        if (! $user || ! $user->hasAdminAccess()) {
            abort(403, 'Acces admin requis.');
        }

        return response()->json([
            'manychat' => [
                'apiKey' => trim((string) config('services.manychat.api_key')) !== '',
                'orderFlow' => trim((string) config('services.manychat.order_confirmation_flow_id')) !== '',
                'cartFlow' => trim((string) config('services.manychat.cart_abandoned_flow_id')) !== '',
            ],
        ]);
    }
}
