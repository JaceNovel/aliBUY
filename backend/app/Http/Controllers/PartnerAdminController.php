<?php

namespace App\Http\Controllers;

use App\Models\ApiPartnerRequest;
use App\Models\PartnerWithdrawal;
use App\Services\PartnerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PartnerAdminController extends Controller
{
    public function __construct(
        protected PartnerService $partners,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->partners->assertAdmin($request->user('sanctum'));

        $requests = ApiPartnerRequest::query()->latest()->get();

        return response()->json([
            'items' => $requests->map(fn (ApiPartnerRequest $partnerRequest) => $this->partners->transformRequest($partnerRequest))->values()->all(),
        ]);
    }

    public function approve(ApiPartnerRequest $apiPartnerRequest, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'webhook_url' => ['nullable', 'url', 'max:2048'],
        ]);

        $payload = $this->partners->approveRequest(
            $apiPartnerRequest,
            $request->user('sanctum'),
            $validated['webhook_url'] ?? null,
        );

        return response()->json([
            'partner' => $this->partners->transformPartner($payload['partner']),
            'app_secret' => $payload['plain_text_secret'],
        ], 201);
    }

    public function reject(ApiPartnerRequest $apiPartnerRequest, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $partnerRequest = $this->partners->rejectRequest($apiPartnerRequest, $request->user('sanctum'), $validated['reason'] ?? null);

        return response()->json([
            'request' => $this->partners->transformRequest($partnerRequest),
        ]);
    }

    public function block(ApiPartnerRequest $apiPartnerRequest, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $partner = $this->partners->blockPartnerRequest($apiPartnerRequest, $request->user('sanctum'), $validated['reason'] ?? null);

        return response()->json([
            'partner' => $this->partners->transformPartner($partner),
            'request' => $this->partners->transformRequest($apiPartnerRequest->fresh()),
        ]);
    }

    public function reactivate(ApiPartnerRequest $apiPartnerRequest, Request $request): JsonResponse
    {
        $partner = $this->partners->reactivatePartnerRequest($apiPartnerRequest, $request->user('sanctum'));

        return response()->json([
            'partner' => $this->partners->transformPartner($partner),
            'request' => $this->partners->transformRequest($apiPartnerRequest->fresh()),
        ]);
    }

    public function withdrawals(Request $request): JsonResponse
    {
        $this->partners->assertAdmin($request->user('sanctum'));

        $items = PartnerWithdrawal::query()
            ->with(['partner.wallet'])
            ->latest()
            ->get();

        return response()->json([
            'items' => $items->map(function (PartnerWithdrawal $withdrawal) {
                $payload = $this->partners->transformWithdrawal($withdrawal);
                $payload['partner'] = [
                    'id' => (string) $withdrawal->partner_id,
                    'companyName' => $withdrawal->partner?->company_name,
                    'email' => $withdrawal->partner?->email,
                    'walletBalance' => (float) ($withdrawal->partner?->wallet?->balance ?? 0),
                ];

                return $payload;
            })->values()->all(),
        ]);
    }

    public function approveWithdrawal(PartnerWithdrawal $partnerWithdrawal, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $withdrawal = $this->partners->approveWithdrawal($partnerWithdrawal, $request->user('sanctum'), $validated['admin_note'] ?? null);

        return response()->json([
            'withdrawal' => $this->partners->transformWithdrawal($withdrawal),
        ]);
    }

    public function rejectWithdrawal(PartnerWithdrawal $partnerWithdrawal, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $withdrawal = $this->partners->rejectWithdrawal($partnerWithdrawal, $request->user('sanctum'), $validated['admin_note'] ?? null);

        return response()->json([
            'withdrawal' => $this->partners->transformWithdrawal($withdrawal),
        ]);
    }
}