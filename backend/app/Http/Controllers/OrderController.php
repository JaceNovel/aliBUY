<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(
        protected OrderService $orders,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');

        return response()->json([
            'orders' => $this->orders->indexForUser($user, $request),
        ]);
    }

    public function show(Order $order): JsonResponse
    {
        $user = request()->user('sanctum');
        $this->orders->assertVisibleToUser($order, $user);

        return response()->json([
            'order' => $this->orders->transformOrder($order->load('payments')),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customerName' => ['required', 'string', 'max:255'],
            'customerEmail' => ['required', 'email', 'max:255'],
            'customerPhone' => ['nullable', 'string', 'max:50'],
            'addressLine1' => ['nullable', 'string', 'max:255'],
            'addressLine2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:120'],
            'state' => ['nullable', 'string', 'max:120'],
            'postalCode' => ['nullable', 'string', 'max:40'],
            'countryCode' => ['required', 'string', 'size:2'],
            'shippingMethod' => ['required', 'in:air,sea,freight'],
            'paymentMethod' => ['nullable', 'string', 'max:50'],
            'promoCode' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.slug' => ['nullable', 'string'],
            'items.*.title' => ['nullable', 'string'],
            'items.*.productName' => ['nullable', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.image' => ['nullable', 'string'],
            'items.*.finalLinePriceFcfa' => ['nullable', 'numeric', 'min:0'],
        ]);

        $order = $this->orders->store($validated, $request->user('sanctum'));

        return response()->json([
            'order' => $this->orders->transformOrder($order),
        ], 201);
    }

    public function applyPromo(Order $order, Request $request): JsonResponse
    {
        $this->orders->assertVisibleToUser($order, $request->user('sanctum'));
        $validated = $request->validate(['code' => ['required', 'string', 'max:60']]);
        $payload = $this->orders->applyPromo($order, $validated['code']);

        return response()->json($payload);
    }
}
