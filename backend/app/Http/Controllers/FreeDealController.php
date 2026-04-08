<?php

namespace App\Http\Controllers;

use App\Services\FreeDealService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FreeDealController extends Controller
{
    public function __construct(
        protected FreeDealService $freeDeals,
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
        ]);

        return response()->json($this->freeDeals->checkout($validated));
    }
}