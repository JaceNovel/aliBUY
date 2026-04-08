<?php

namespace App\Http\Controllers;

use App\Services\CartSharingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function __construct(
        protected CartSharingService $carts,
    ) {
    }

    public function syncActivity(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $payload = $request->json()->all();
        $action = is_string($payload['action'] ?? null) ? (string) $payload['action'] : 'sync';

        if ($action === 'clear') {
            return response()->json([
                'ok' => true,
                'record' => $this->carts->clearAbandonedCartRecord($user, 'cleared'),
            ]);
        }

        return response()->json([
            'ok' => true,
            'record' => $this->carts->upsertAbandonedCartRecord($user, [
                'items' => is_array($payload['items'] ?? null) ? $payload['items'] : [],
            ]),
            'reminder' => null,
        ]);
    }

    public function createShare(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $payload = $request->json()->all();
        $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

        if ($this->carts->countValidItems($items) === 0) {
            return response()->json([
                'message' => 'Panier vide.',
            ], 400);
        }

        $message = is_string($payload['message'] ?? null) ? (string) $payload['message'] : null;
        $sharedCart = $this->carts->createSharedCart($user, $items, $message);
        $origin = $this->carts->resolveOrigin($request);
        $shareUrl = $origin.'/cart/shared/'.rawurlencode((string) $sharedCart['token']);
        $shareText = ! empty($sharedCart['message'])
            ? (string) $sharedCart['message']
            : config('app.name').': valide ce panier';

        return response()->json([
            'id' => $sharedCart['id'],
            'shareUrl' => $shareUrl,
            'shareText' => $shareText,
            'copyText' => $shareText.' '.$shareUrl,
            'token' => $sharedCart['token'],
        ]);
    }

    public function claimShare(Request $request, string $token): JsonResponse
    {
        $user = $request->user('sanctum');
        $sharedCart = $this->carts->getSharedCartByToken($token);
        if (! $sharedCart) {
            return response()->json([
                'message' => 'Lien panier introuvable.',
            ], 404);
        }

        $this->carts->markSharedCartClaimed($token, (string) $user->id, (string) $user->name);

        return response()->json([
            'ok' => true,
            'cartItems' => $sharedCart['items'],
            'sharedContext' => [
                'token' => $sharedCart['token'],
                'ownerUserId' => $sharedCart['ownerUserId'],
                'ownerEmail' => $sharedCart['ownerEmail'],
                'ownerDisplayName' => $sharedCart['ownerDisplayName'],
                'message' => $sharedCart['message'] ?? null,
                'importedAt' => now()->toIso8601String(),
            ],
        ]);
    }
}