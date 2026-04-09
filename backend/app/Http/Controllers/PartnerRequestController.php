<?php

namespace App\Http\Controllers;

use App\Services\PartnerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PartnerRequestController extends Controller
{
    public function __construct(
        protected PartnerService $partners,
    ) {
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'website' => ['nullable', 'url', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'description' => ['required', 'string', 'min:20'],
        ]);

        $partnerRequest = $this->partners->submitRequest($validated);

        return response()->json([
            'request' => $this->partners->transformRequest($partnerRequest),
        ], 201);
    }
}