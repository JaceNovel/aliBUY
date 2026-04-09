<?php

namespace App\Http\Controllers;

use App\Models\ApiPartnerRequest;
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
        $partnerRequest = $this->partners->rejectRequest($apiPartnerRequest, $request->user('sanctum'));

        return response()->json([
            'request' => $this->partners->transformRequest($partnerRequest),
        ]);
    }
}