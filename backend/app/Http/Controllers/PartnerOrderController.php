<?php

namespace App\Http\Controllers;

use App\Models\ApiPartner;
use App\Services\PartnerOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PartnerOrderController extends Controller
{
    public function __construct(
        protected PartnerOrderService $partnerOrders,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->partnerOrders->listOrders($this->partner($request), $request));
    }

    public function show(string $id, Request $request): JsonResponse
    {
        return response()->json($this->partnerOrders->showOrder($this->partner($request), $id));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'shipping_method' => ['nullable', 'in:air,sea,freight'],
            'customer' => ['required', 'array'],
            'customer.name' => ['required', 'string', 'max:255'],
            'customer.phone' => ['required', 'string', 'max:50'],
            'customer.email' => ['nullable', 'email', 'max:255'],
            'customer.country_code' => ['nullable', 'string', 'size:2'],
        ]);

        $payload = $this->partnerOrders->createOrder($this->partner($request), $validated);

        return response()->json($payload, 201);
    }

    public function balance(Request $request): JsonResponse
    {
        return response()->json($this->partnerOrders->wallet($this->partner($request)));
    }

    protected function partner(Request $request): ApiPartner
    {
        return $request->attributes->get('api_partner');
    }
}