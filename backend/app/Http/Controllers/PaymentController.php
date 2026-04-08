<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        protected PaymentService $payments,
    ) {
    }

    public function init(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'orderId' => ['required'],
            'provider' => ['nullable', 'in:moneroo,fedapay'],
        ]);

        $order = Order::query()->findOrFail($validated['orderId']);
        $this->payments->assertVisibleToUser($order, $request->user('sanctum'));
        $payload = $this->payments->initialize($order, (string) ($validated['provider'] ?? config('app.payment_provider', 'moneroo')));

        return response()->json($payload);
    }

    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'orderId' => ['required'],
            'paymentId' => ['required', 'string'],
            'provider' => ['nullable', 'in:moneroo,fedapay'],
        ]);

        $order = Order::query()->findOrFail($validated['orderId']);
        $this->payments->assertVisibleToUser($order, $request->user('sanctum'));
        $payload = $this->payments->verify($order, $validated['paymentId'], (string) ($validated['provider'] ?? config('app.payment_provider', 'moneroo')));

        return response()->json($payload);
    }

    public function webhook(Request $request): JsonResponse
    {
        return response()->json($this->payments->handleWebhook('moneroo', $request));
    }

    public function monerooWebhook(Request $request): JsonResponse
    {
        return response()->json($this->payments->handleWebhook('moneroo', $request));
    }
}
