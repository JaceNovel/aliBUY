<?php

namespace App\Http\Controllers;

use App\Services\AlibabaAdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Throwable;

class AlibabaAdminController extends Controller
{
    public function __construct(
        protected AlibabaAdminService $alibabaAdmin,
    ) {
    }

    public function dashboard(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json(
            $this->alibabaAdmin->buildDashboard($request->query('panel'))
        );
    }

    public function search(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->search($this->withSourcingProvider($request, $request->json()->all())));
    }

    public function fetchRemote(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->fetchRemote($this->withSourcingProvider($request, $request->json()->all())));
    }

    public function probe(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        try {
            return response()->json($this->alibabaAdmin->probe($this->withSourcingProvider($request, $request->json()->all())));
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function import(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->import($this->withSourcingProvider($request, $request->json()->all())));
    }

    public function deleteImport(Request $request, string $importedProductId): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->deleteImportedProducts(
            $importedProductId,
            $request->query('sourceProductId')
        ));
    }

    public function purgeImports(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->deleteImportedProducts(
            null,
            null,
            $request->boolean('siteReset')
        ));
    }

    public function reenrichImport(Request $request, string $importedProductId): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->reenrichImportedProduct($importedProductId));
    }

    public function reenrichAllImports(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->reenrichAllImportedProducts());
    }

    public function supplierAccounts(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        try {
            return response()->json($this->alibabaAdmin->saveSupplierAccount($this->withSourcingProvider($request, $request->json()->all())));
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function oauthStart(Request $request): RedirectResponse|JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        $payload = $this->withSourcingProvider($request, $request->all());
        $shouldRedirect = $request->isMethod('GET') || ($payload['responseMode'] ?? null) === 'redirect';

        try {
            $redirectUrl = $this->alibabaAdmin->oauthStartRedirectUrl($payload);
        } catch (Throwable $exception) {
            if ($shouldRedirect) {
                return redirect()->away($this->buildOauthFailureTarget($request, $payload, $exception->getMessage()));
            }

            return response()->json([
                'error' => true,
                'message' => $exception->getMessage(),
            ], 422);
        }

        if ($shouldRedirect) {
            return redirect()->away($redirectUrl);
        }

        return response()->json([
            'redirectUrl' => $redirectUrl,
        ]);
    }

    protected function buildOauthFailureTarget(Request $request, array $payload, string $message): string
    {
        $origin = trim((string) ($payload['origin'] ?? ''));
        if ($origin === '') {
            $referer = trim((string) $request->headers->get('referer', ''));
            if ($referer !== '') {
                $origin = preg_replace('#/api/.*$#', '', $referer) ?: $referer;
            }
        }

        if ($origin === '') {
            $origin = rtrim((string) config('app.frontend_url', config('app.url', 'https://afripay.space')), '/');
        }

        $target = rtrim($origin, '/').(($payload['provider'] ?? null) === 'alibaba' ? '/admin/alibaba-sourcing/accounts' : '/admin/aliexpress-sourcing/accounts');
        $separator = str_contains($target, '?') ? '&' : '?';

        return $target.$separator.'oauth=failed&message='.rawurlencode($message !== '' ? $message : 'Demarrage OAuth AliExpress impossible.');
    }

    public function oauthCallback(Request $request): RedirectResponse
    {
        return redirect()->away($this->alibabaAdmin->handleOAuthCallback(
            $request->query('code'),
            $request->query('state')
        ));
    }

    public function refreshSupplierAccount(Request $request, string $accountId): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->refreshSupplierAccount($accountId));
    }

    protected function withSourcingProvider(Request $request, array $payload): array
    {
        $provider = str_contains($request->path(), 'admin/alibaba/') ? 'alibaba' : 'aliexpress';

        return [
            ...$payload,
            'provider' => $payload['provider'] ?? $provider,
        ];
    }

    public function receptionAddresses(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->saveReceptionAddress($request->json()->all()));
    }

    public function countryProfiles(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->saveCountryProfiles(
            is_array($request->json('profiles')) ? $request->json('profiles') : []
        ));
    }

    public function publish(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->publishImportedProducts(
            is_array($request->json('productIds')) ? $request->json('productIds') : []
        ));
    }

    public function purchaseOrders(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        try {
            return response()->json($this->alibabaAdmin->createPurchaseOrder($request->json()->all()));
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function payPurchaseOrder(Request $request, string $orderId): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        try {
            return response()->json($this->alibabaAdmin->payPurchaseOrder(
                $orderId,
                (string) $request->json('action', 'pay')
            ));
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }
}
