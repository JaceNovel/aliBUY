<?php

namespace App\Http\Controllers;

use App\Services\PricingContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PricingContextController extends Controller
{
    public function __construct(
        protected PricingContextService $pricing,
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->pricing->build($request));
    }
}