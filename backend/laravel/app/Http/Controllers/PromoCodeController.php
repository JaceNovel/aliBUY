<?php

namespace App\Http\Controllers;

use App\Services\PromoCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PromoCodeController extends Controller
{
    public function __construct(
        protected PromoCodeService $promoCodes,
    ) {
    }

    public function preview(Request $request): JsonResponse
    {
        $body = $request->json()->all();
        $code = is_string($body['code'] ?? null) ? trim((string) $body['code']) : '';
        $totalFcfa = is_numeric($body['totalFcfa'] ?? null) ? (float) $body['totalFcfa'] : 0;

        if ($code === '') {
            return response()->json([
                'message' => 'Saisissez un code promo.',
            ], 400);
        }

        try {
            return response()->json($this->promoCodes->validateForAmount($code, $totalFcfa));
        } catch (\Throwable $error) {
            return response()->json([
                'message' => $error instanceof \Exception ? $error->getMessage() : 'Impossible de valider ce code promo.',
            ], 400);
        }
    }
}