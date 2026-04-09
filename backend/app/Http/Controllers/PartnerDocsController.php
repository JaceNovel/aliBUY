<?php

namespace App\Http\Controllers;

use App\Services\PartnerService;
use Illuminate\Http\JsonResponse;

class PartnerDocsController extends Controller
{
    public function __construct(
        protected PartnerService $partners,
    ) {
    }

    public function show(): JsonResponse
    {
        return response()->json($this->partners->docs());
    }
}