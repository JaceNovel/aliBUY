<?php

namespace App\Http\Controllers;

use App\Services\FavoriteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FavoriteController extends Controller
{
    public function __construct(
        protected FavoriteService $favorites,
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        $productSlug = trim((string) $request->query('productSlug', ''));
        if ($productSlug === '') {
            return response()->json([
                'message' => 'Produit invalide.',
            ], 400);
        }

        $user = $request->user('sanctum');
        if (! $user) {
            return response()->json([
                'authenticated' => false,
                'isFavorite' => false,
            ]);
        }

        return response()->json([
            'authenticated' => true,
            'isFavorite' => $this->favorites->isFavorite($user, $productSlug),
        ]);
    }

    public function toggle(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        if (! $user) {
            return response()->json([
                'message' => 'Connexion requise.',
            ], 401);
        }

        $validated = $request->validate([
            'productSlug' => ['required', 'string', 'max:255'],
        ]);

        return response()->json($this->favorites->toggle($user, trim((string) $validated['productSlug'])));
    }
}