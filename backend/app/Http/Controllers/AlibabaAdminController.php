<?php

namespace App\Http\Controllers;

use App\Services\AlibabaAdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

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

        return response()->json($this->alibabaAdmin->search($request->json()->all()));
    }

    public function fetchRemote(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->fetchRemote($request->json()->all()));
    }

    public function import(Request $request): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->import($request->json()->all()));
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

        return response()->json($this->alibabaAdmin->deleteImportedProducts());
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

        return response()->json($this->alibabaAdmin->saveSupplierAccount($request->json()->all()));
    }

    public function oauthStart(Request $request): RedirectResponse|JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        $payload = $request->all();
        if (($payload['responseMode'] ?? null) === 'redirect') {
            return redirect()->away($this->alibabaAdmin->oauthStartRedirectUrl($payload));
        }

        return response()->json([
            'redirectUrl' => $this->alibabaAdmin->oauthStartRedirectUrl($payload),
        ]);
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

        return response()->json($this->alibabaAdmin->createPurchaseOrder($request->json()->all()));
    }

    public function payPurchaseOrder(Request $request, string $orderId): JsonResponse
    {
        $this->alibabaAdmin->assertAdmin($request->user('sanctum'));

        return response()->json($this->alibabaAdmin->payPurchaseOrder(
            $orderId,
            (string) $request->json('action', 'pay')
        ));
    }
}