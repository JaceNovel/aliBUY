<?php

namespace App\Http\Controllers;

use App\Services\SourcingQuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SourcingQuoteController extends Controller
{
    public function __construct(
        protected SourcingQuoteService $sourcingQuotes,
    ) {
    }

    public function quote(Request $request): JsonResponse
    {
        $payload = $request->json()->all();

        return response()->json($this->sourcingQuotes->buildQuote(
            is_array($payload['items'] ?? null) ? $payload['items'] : [],
            [
                'disableFreeAir' => ($payload['disableFreeAir'] ?? null) === true,
                'countryCode' => is_string($payload['countryCode'] ?? null) ? (string) $payload['countryCode'] : null,
                'deliveryMode' => ($payload['deliveryMode'] ?? null) === 'forwarder' ? 'forwarder' : 'direct',
            ],
        ));
    }
}