<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\PaymentService;
use App\Services\PayPalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        protected PaymentService $payments,
        protected PayPalService $paypal,
    ) {
    }

    public function init(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'orderId' => ['required'],
            'provider' => ['nullable', 'in:moneroo,fedapay,paypal'],
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
            'provider' => ['nullable', 'in:moneroo,fedapay,paypal'],
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

    public function paypalWebhook(Request $request): JsonResponse
    {
        return response()->json($this->payments->handleWebhook('paypal', $request));
    }

    public function proxyPayPalInit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'currency' => ['required', 'string', 'max:10'],
            'description' => ['nullable', 'string', 'max:255'],
            'return_url' => ['required', 'url'],
            'cancel_url' => ['nullable', 'url'],
            'metadata' => ['nullable', 'array'],
        ]);

        $payment = $this->paypal->initialize($validated);

        return response()->json([
            'paymentId' => (string) ($payment['id'] ?? ''),
            'checkoutUrl' => $this->extractPayPalCheckoutUrl($payment),
            'paymentStatus' => (string) ($payment['status'] ?? 'created'),
            'payment' => $payment,
        ]);
    }

    public function proxyPayPalVerify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'paymentId' => ['required', 'string'],
        ]);

        $payment = $this->paypal->verify((string) $validated['paymentId']);

        return response()->json([
            'paymentId' => (string) ($payment['id'] ?? $validated['paymentId']),
            'checkoutUrl' => $this->extractPayPalCheckoutUrl($payment),
            'paymentStatus' => (string) ($payment['status'] ?? 'pending'),
            'payment' => $payment,
        ]);
    }

    protected function extractPayPalCheckoutUrl(array $payload): ?string
    {
        $links = $payload['links'] ?? null;
        if (! is_array($links)) {
            return null;
        }

        foreach ($links as $link) {
            if (! is_array($link)) {
                continue;
            }

            if (($link['rel'] ?? null) === 'approve' && is_string($link['href'] ?? null) && trim((string) $link['href']) !== '') {
                return trim((string) $link['href']);
            }
        }

        return null;
    }
}
