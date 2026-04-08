<?php

namespace App\Http\Controllers;

use App\Services\CustomerInteractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuoteController extends Controller
{
    public function __construct(
        protected CustomerInteractionService $interactions,
    ) {
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $payload = $request->json()->all();

        $productName = is_string($payload['productName'] ?? null) ? trim((string) $payload['productName']) : '';
        $quantity = is_string($payload['quantity'] ?? null) ? trim((string) $payload['quantity']) : '';
        $specifications = is_string($payload['specifications'] ?? null) ? trim((string) $payload['specifications']) : '';

        if ($productName === '' || $quantity === '' || $specifications === '') {
            return response()->json([
                'message' => 'Produit, quantite et specifications sont obligatoires.',
            ], 400);
        }

        return response()->json([
            'ok' => true,
            'request' => $this->interactions->createQuoteRequest($user, [
                'productName' => $productName,
                'quantity' => $quantity,
                'specifications' => $specifications,
                'budget' => is_string($payload['budget'] ?? null) ? (string) $payload['budget'] : '',
                'shippingWindow' => is_string($payload['shippingWindow'] ?? null) ? (string) $payload['shippingWindow'] : '',
                'notes' => is_string($payload['notes'] ?? null) ? (string) $payload['notes'] : null,
            ]),
        ], 201);
    }

    public function syncDraft(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $payload = $request->json()->all();
        $action = ($payload['action'] ?? null) === 'clear' ? 'clear' : 'sync';

        if ($action === 'clear') {
            return response()->json([
                'ok' => true,
                'record' => $this->interactions->clearAbandonedQuoteRecord($user, 'cleared'),
            ]);
        }

        return response()->json([
            'ok' => true,
            'record' => $this->interactions->upsertAbandonedQuoteRecord($user, [
                'productName' => is_string($payload['productName'] ?? null) ? (string) $payload['productName'] : '',
                'quantity' => is_string($payload['quantity'] ?? null) ? (string) $payload['quantity'] : '',
                'specifications' => is_string($payload['specifications'] ?? null) ? (string) $payload['specifications'] : '',
                'budget' => is_string($payload['budget'] ?? null) ? (string) $payload['budget'] : '',
                'shippingWindow' => is_string($payload['shippingWindow'] ?? null) ? (string) $payload['shippingWindow'] : '',
                'notes' => is_string($payload['notes'] ?? null) ? (string) $payload['notes'] : null,
            ]),
        ]);
    }
}