<?php

namespace App\Http\Controllers;

use App\Services\PartnerOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PartnerProductController extends Controller
{
    public function __construct(
        protected PartnerOrderService $partnerOrders,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->partnerOrders->paginateProducts($request));
    }
}