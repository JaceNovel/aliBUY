<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Payment;
use App\Services\MonerooService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        protected MonerooService $moneroo,
    ) {
    }

    public function init(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'orderId' => ['required', 'integer'],
        ]);

        $order = Order::query()->findOrFail($validated['orderId']);
        $payment = $this->moneroo->initialize([
            'amount' => (float) $order->total_price,
            'currency' => $order->payment_currency ?? 'XOF',
            'description' => "Paiement commande {$order->order_number}",
            'metadata' => [
                'orderId' => $order->id,
                'orderNumber' => $order->order_number,
            ],
        ]);

        $record = Payment::query()->create([
            'order_id' => $order->id,
            'provider' => 'moneroo',
            'status' => (string) ($payment['status'] ?? 'initialized'),
            'transaction_id' => (string) ($payment['id'] ?? ''),
            'checkout_url' => $payment['checkout_url'] ?? null,
            'payload' => $payment,
        ]);

        $order->payment_status = 'initialized';
        $order->save();

        return response()->json([
            'order' => app(OrderController::class)->show($order)->getData(true)['order'],
            'paymentId' => $record->transaction_id,
            'checkoutUrl' => $record->checkout_url,
            'paymentStatus' => $record->status,
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'orderId' => ['required', 'integer'],
            'paymentId' => ['required', 'string'],
        ]);

        $order = Order::query()->findOrFail($validated['orderId']);
        $payload = $this->moneroo->verify($validated['paymentId']);
        $status = (string) ($payload['status'] ?? 'pending');

        Payment::query()
            ->where('order_id', $order->id)
            ->where('transaction_id', $validated['paymentId'])
            ->latest()
            ->first()?->update([
                'status' => $status,
                'payload' => $payload,
            ]);

        $order->payment_status = in_array($status, ['successful', 'paid'], true) ? 'paid' : $status;
        $order->save();

        return response()->json([
            'order' => app(OrderController::class)->show($order)->getData(true)['order'],
            'paymentId' => $validated['paymentId'],
            'paymentStatus' => $status,
        ]);
    }

    public function webhook(Request $request): JsonResponse
    {
        $signature = (string) $request->header('x-moneroo-signature', '');
        $body = (string) $request->getContent();

        if (! $this->moneroo->isValidWebhookSignature($signature, $body)) {
          return response()->json(['message' => 'Invalid webhook signature.'], 401);
        }

        $payload = $request->json()->all();
        $paymentId = (string) ($payload['id'] ?? '');
        $status = (string) ($payload['status'] ?? 'pending');

        $payment = Payment::query()
            ->where('transaction_id', $paymentId)
            ->latest()
            ->first();

        if ($payment) {
            $payment->update([
                'status' => $status,
                'payload' => $payload,
            ]);

            $payment->order?->update([
                'payment_status' => in_array($status, ['successful', 'paid'], true) ? 'paid' : $status,
            ]);
        }

        return response()->json(['received' => true]);
    }
}
