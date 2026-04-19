<?php

namespace App\Http\Controllers;

use App\Services\AlibabaAdminService;
use App\Services\FreeDealService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class FreeDealController extends Controller
{
    public function __construct(
        protected FreeDealService $freeDeals,
        protected AlibabaAdminService $alibabaAdmin,
    ) {
    }

    public function state(Request $request): JsonResponse
    {
        return response()->json($this->freeDeals->state($request));
    }

    public function checkout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'selectedSlugs' => ['required', 'array', 'min:1'],
            'selectedSlugs.*' => ['required', 'string', 'max:255'],
            'customerName' => ['required', 'string', 'max:255'],
            'customerEmail' => ['required', 'email', 'max:255'],
            'customerPhone' => ['required', 'string', 'max:50'],
            'addressLine1' => ['required', 'string', 'max:255'],
            'addressLine2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:120'],
            'state' => ['nullable', 'string', 'max:120'],
            'postalCode' => ['nullable', 'string', 'max:40'],
            'countryCode' => ['required', 'string', 'size:2'],
            'manychatSubscriberId' => ['nullable', 'string', 'max:255'],
            'manychatFlowId' => ['nullable', 'string', 'max:255'],
            'manychatPaidTagId' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json($this->freeDeals->checkout($validated));
    }

    public function verifyPayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'orderId' => ['required'],
            'paymentId' => ['nullable', 'string'],
            'provider' => ['nullable', 'in:moneroo,fedapay'],
        ]);

        return response()->json($this->freeDeals->verifyPayment($validated));
    }

    public function adminShow(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json(['config' => $this->freeDeals->adminConfig()]);
    }

    public function adminSave(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json(['config' => $this->freeDeals->saveAdminConfig($request->json()->all())]);
    }

    public function adminImport(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        $payload = $request->json()->all();
        $maxUsd = max(0.1, (float) ($payload['maxUsd'] ?? 5));
        try {
            $import = $this->alibabaAdmin->import([
                ...$payload,
                'provider' => 'alibaba',
                'autoPublish' => true,
                'campaignMode' => 'free-deal',
                'limit' => max(1, (int) ($payload['limit'] ?? 18)),
            ]);
        } catch (Throwable $exception) {
            $message = trim($exception->getMessage());
            $normalizedMessage = strtolower($message);
            if (str_contains($normalizedMessage, 'api path') || str_contains($normalizedMessage, 'specified api path')) {
                $message = "Import Articles gratuits indisponible par mot-cle sur ce compte Alibaba. Colle un lien produit Alibaba ou un product_id exact, ou utilise un article deja importe/catalogue qui correspond a ta recherche, puis relance l'import.";
            }

            return response()->json([
                'message' => $message !== '' ? $message : "Import fournisseur impossible pour l'offre gratuite.",
            ], 422);
        }

        $products = collect($import['products'] ?? [])
            ->filter(fn ($product) => is_array($product) && (float) ($product['minUsd'] ?? 0) > 0 && (float) ($product['minUsd'] ?? 0) <= $maxUsd)
            ->sortBy(fn ($product) => (float) ($product['minUsd'] ?? 0))
            ->values();
        $slugs = $products
            ->map(fn ($product) => (string) ($product['slug'] ?? ''))
            ->filter()
            ->values()
            ->all();
        $currentConfig = $this->freeDeals->adminConfig();
        $nextSlugs = count($slugs) > 0
            ? array_values(array_unique([...($currentConfig['productSlugs'] ?? []), ...$slugs]))
            : ($currentConfig['productSlugs'] ?? []);
        $config = $this->freeDeals->saveAdminConfig([
            'productSlugs' => $nextSlugs,
        ]);

        return response()->json([
            ...$import,
            'config' => $config,
            'importedCount' => count($import['products'] ?? []),
            'freeDealProductSlugs' => $nextSlugs,
            'newFreeDealProductSlugs' => $slugs,
        ]);
    }
}
