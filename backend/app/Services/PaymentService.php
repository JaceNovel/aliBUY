<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaymentService
{
    public function __construct(
        protected OrderService $orders,
        protected MonerooService $moneroo,
        protected FedaPayService $fedapay,
        protected PartnerSettlementService $partnerSettlement,
    ) {
    }

    public function assertVisibleToUser(Order $order, ?User $user): void
    {
        $this->orders->assertVisibleToUser($order, $user);
    }

    public function initialize(Order $order, string $provider = 'moneroo'): array
    {
        $provider = $this->normalizeProvider($provider);

        if (in_array($order->payment_status, ['initialized', 'pending'], true) && $order->payment_checkout_url) {
            return [
                'order' => $this->orders->transformOrder($order->fresh('payments')),
                'paymentId' => $order->payment_reference,
                'checkoutUrl' => $order->payment_checkout_url,
                'paymentStatus' => $order->payment_status,
            ];
        }

        $payload = match ($provider) {
            'fedapay' => $this->fedapay->initialize($this->buildGatewayPayload($order)),
            default => $this->moneroo->initialize($this->buildGatewayPayload($order)),
        };

        $paymentId = (string) ($payload['id'] ?? $payload['data']['id'] ?? '');
        $checkoutUrl = $this->extractCheckoutUrl($payload);
        $status = (string) ($payload['status'] ?? $payload['data']['status'] ?? 'initialized');

        Payment::query()->create([
            'order_id' => $order->id,
            'provider' => $provider,
            'status' => $status,
            'transaction_id' => $paymentId,
            'provider_reference' => $paymentId,
            'checkout_url' => $checkoutUrl,
            'payload' => $payload,
        ]);

        $order->forceFill([
            'payment_status' => $status,
            'payment_provider' => $provider,
            'payment_reference' => $paymentId,
            'payment_checkout_url' => $checkoutUrl,
            'payment_provider_payload' => $payload,
        ])->save();

        Log::channel('payment')->info('payment.initialized', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'provider' => $provider,
            'payment_id' => $paymentId,
            'status' => $status,
        ]);

        return [
            'order' => $this->orders->transformOrder($order->fresh('payments')),
            'paymentId' => $paymentId,
            'checkoutUrl' => $checkoutUrl,
            'paymentStatus' => $status,
        ];
    }

    public function verify(Order $order, string $paymentId, string $provider = 'moneroo'): array
    {
        $provider = $this->normalizeProvider($provider);
        $payload = match ($provider) {
            'fedapay' => $this->fedapay->verify($paymentId),
            default => $this->moneroo->verify($paymentId),
        };

        $status = (string) ($payload['status'] ?? $payload['data']['status'] ?? 'pending');
        $normalizedStatus = $this->normalizePaidStatus($status);

        Payment::query()
            ->where('order_id', $order->id)
            ->where('transaction_id', $paymentId)
            ->latest()
            ->first()?->update([
                'status' => $normalizedStatus,
                'payload' => $payload,
                'verified_at' => now(),
            ]);

        $order->forceFill([
            'payment_status' => $normalizedStatus,
            'payment_provider' => $provider,
            'payment_reference' => $paymentId,
            'payment_provider_payload' => $payload,
        ])->save();

        $this->partnerSettlement->settlePaidOrder($order->fresh(['partnerOrder.partner', 'payments']));

        Log::channel('payment')->info('payment.verified', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'provider' => $provider,
            'payment_id' => $paymentId,
            'status' => $normalizedStatus,
        ]);

        return [
            'order' => $this->orders->transformOrder($order->fresh('payments')),
            'payment' => $payload,
        ];
    }

    public function handleWebhook(string $provider, Request $request): array
    {
        $provider = $this->normalizeProvider($provider);
        $rawBody = (string) $request->getContent();
        $signature = (string) ($provider === 'fedapay'
            ? $request->header('x-fedapay-signature', '')
            : $request->header('x-moneroo-signature', ''));

        $signatureValid = $provider === 'fedapay'
            ? $this->fedapay->isValidWebhookSignature($signature, $rawBody)
            : $this->moneroo->isValidWebhookSignature($signature, $rawBody);

        if (! $signatureValid) {
            throw new AuthorizationException('Invalid webhook signature.');
        }

        $payload = $request->json()->all();
        $paymentId = (string) ($payload['id'] ?? $payload['data']['id'] ?? '');
        if ($paymentId === '') {
            return ['received' => true, 'ignored' => true];
        }

        $payment = Payment::query()->where('transaction_id', $paymentId)->latest()->first();
        if (! $payment) {
            Log::channel('payment')->warning('payment.webhook.unmatched', [
                'provider' => $provider,
                'payment_id' => $paymentId,
            ]);

            return ['received' => true, 'ignored' => true];
        }

        $status = $this->normalizePaidStatus((string) ($payload['status'] ?? $payload['data']['status'] ?? 'pending'));
        $payment->update([
            'status' => $status,
            'payload' => $payload,
            'verified_at' => now(),
        ]);

        $payment->order?->forceFill([
            'payment_status' => $status,
            'payment_provider' => $provider,
            'payment_reference' => $paymentId,
            'payment_provider_payload' => $payload,
        ])->save();

        if ($payment->order) {
            $this->partnerSettlement->settlePaidOrder($payment->order->fresh(['partnerOrder.partner', 'payments']));
        }

        Log::channel('payment')->info('payment.webhook.received', [
            'provider' => $provider,
            'payment_id' => $paymentId,
            'status' => $status,
        ]);

        return ['received' => true];
    }

    protected function buildGatewayPayload(Order $order): array
    {
        return [
            'amount' => (float) $order->total_price,
            'currency' => $order->payment_currency ?? 'XOF',
            'description' => 'Paiement commande sourcing '.$order->order_number,
            'return_url' => rtrim((string) env('PAYMENT_RETURN_URL', config('services.frontend.url').'/orders'), '/').'?orderId='.$order->id,
            'cancel_url' => (string) env('PAYMENT_CANCEL_URL', config('services.frontend.url').'/cart'),
            'customer' => [
                'email' => $order->customer_email,
                'first_name' => $order->customer_name,
                'last_name' => 'AfriPay',
                'phone' => $order->customer_phone,
                'country' => $order->country_code,
                'city' => $order->city,
            ],
            'metadata' => [
                'orderId' => (string) $order->id,
                'orderNumber' => $order->order_number,
                'customerEmail' => $order->customer_email,
            ],
            'methods' => config('services.moneroo.methods', []),
        ];
    }

    protected function normalizeProvider(string $provider): string
    {
        return in_array($provider, ['moneroo', 'fedapay'], true) ? $provider : 'moneroo';
    }

    protected function normalizePaidStatus(string $status): string
    {
        return in_array(strtolower($status), ['successful', 'success', 'paid', 'approved', 'completed'], true)
            ? 'paid'
            : $status;
    }

    protected function extractCheckoutUrl(array $payload): ?string
    {
        $candidates = [
            $payload['checkout_url'] ?? null,
            $payload['checkoutUrl'] ?? null,
            $payload['payment_url'] ?? null,
            $payload['paymentUrl'] ?? null,
            $payload['hosted_url'] ?? null,
            $payload['hostedUrl'] ?? null,
            $payload['redirect_url'] ?? null,
            $payload['redirectUrl'] ?? null,
            $payload['url'] ?? null,
            $payload['data']['checkout_url'] ?? null,
            $payload['data']['checkoutUrl'] ?? null,
            $payload['data']['payment_url'] ?? null,
            $payload['data']['paymentUrl'] ?? null,
            $payload['data']['hosted_url'] ?? null,
            $payload['data']['hostedUrl'] ?? null,
            $payload['data']['redirect_url'] ?? null,
            $payload['data']['redirectUrl'] ?? null,
            $payload['data']['url'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return null;
    }
}