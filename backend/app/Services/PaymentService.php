<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PaymentService
{
    public function __construct(
        protected OrderService $orders,
        protected MonerooService $moneroo,
        protected FedaPayService $fedapay,
        protected PayPalService $paypal,
        protected PartnerSettlementService $partnerSettlement,
        protected EmailAutomationService $emails,
        protected ManyChatService $manychat,
    ) {
    }

    public function assertVisibleToUser(Order $order, ?User $user): void
    {
        $this->orders->assertVisibleToUser($order, $user);
    }

    public function initialize(Order $order, string $provider = 'moneroo'): array
    {
        $provider = $this->normalizeProvider($provider);

        if ((float) $order->total_price <= 0) {
            throw ValidationException::withMessages([
                'orderId' => ['Le montant de cette commande est nul. Recalculez le panier avant de lancer le paiement.'],
            ]);
        }

        if (
            in_array($order->payment_status, ['initialized', 'pending'], true)
            && $order->payment_checkout_url
            && ($order->payment_provider === $provider || $order->payment_provider === null)
        ) {
            return [
                'order' => $this->orders->transformOrder($order->fresh('payments')),
                'paymentId' => $order->payment_reference,
                'checkoutUrl' => $order->payment_checkout_url,
                'paymentStatus' => $order->payment_status,
            ];
        }

        $previousPaymentStatus = (string) $order->payment_status;
        $payload = match ($provider) {
            'fedapay' => $this->fedapay->initialize($this->buildGatewayPayload($order)),
            'paypal' => $this->paypal->initialize($this->buildGatewayPayload($order, $provider)),
            default => $this->moneroo->initialize($this->buildGatewayPayload($order)),
        };

        $paymentId = $this->resolvePaymentId($payload, $order);
        $checkoutUrl = $this->extractCheckoutUrl($payload);
        $status = $this->normalizeGatewayStatus((string) ($payload['status'] ?? $payload['data']['status'] ?? 'initialized'));

        if ($checkoutUrl === null) {
            throw ValidationException::withMessages([
                'payment' => ['Le prestataire de paiement a initialise la transaction, mais aucune URL de redirection exploitable n a ete retournee.'],
            ]);
        }

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

        if (! in_array($previousPaymentStatus, ['initialized', 'pending'], true)) {
            $this->emails->sendPaymentInitialized($order->loadMissing('user'));
        }

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
            'paypal' => $this->paypal->verify($paymentId),
            default => $this->moneroo->verify($paymentId),
        };

        $status = (string) ($payload['status'] ?? $payload['data']['status'] ?? 'pending');
        $normalizedStatus = $this->normalizeGatewayStatus($status);
        $previousPaymentStatus = (string) $order->payment_status;

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

        if ($normalizedStatus === 'paid') {
            $this->sendPaymentConfirmedAutomations($order->loadMissing('user'), $previousPaymentStatus !== 'paid');
        }

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
        $payload = $request->json()->all();

        $signatureValid = match ($provider) {
            'paypal' => $this->paypal->isValidWebhookSignature([
                'paypal-transmission-id' => (string) $request->header('paypal-transmission-id', ''),
                'paypal-transmission-time' => (string) $request->header('paypal-transmission-time', ''),
                'paypal-transmission-sig' => (string) $request->header('paypal-transmission-sig', ''),
                'paypal-cert-url' => (string) $request->header('paypal-cert-url', ''),
                'paypal-auth-algo' => (string) $request->header('paypal-auth-algo', ''),
            ], $rawBody, $payload),
            'fedapay' => $this->fedapay->isValidWebhookSignature((string) $request->header('x-fedapay-signature', ''), $rawBody),
            default => $this->moneroo->isValidWebhookSignature((string) $request->header('x-moneroo-signature', ''), $rawBody),
        };

        if (! $signatureValid) {
            throw new AuthorizationException('Invalid webhook signature.');
        }

        $paymentId = match ($provider) {
            'paypal' => $this->extractPayPalWebhookOrderId($payload),
            default => (string) ($payload['id'] ?? $payload['data']['id'] ?? ''),
        };

        if ($paymentId === '') {
            return ['received' => true, 'ignored' => true];
        }

        $payment = Payment::query()
            ->where('transaction_id', $paymentId)
            ->orWhere('provider_reference', $paymentId)
            ->latest()
            ->first();

        if (! $payment && $provider === 'paypal') {
            $order = Order::query()->where('payment_reference', $paymentId)->latest()->first();
            if ($order) {
                $payment = Payment::query()->where('order_id', $order->id)->where('provider', 'paypal')->latest()->first();
            }
        }

        if (! $payment) {
            Log::channel('payment')->warning('payment.webhook.unmatched', [
                'provider' => $provider,
                'payment_id' => $paymentId,
            ]);

            return ['received' => true, 'ignored' => true];
        }

        $resolvedPayload = $provider === 'paypal'
            ? $this->paypal->verify($paymentId)
            : $payload;

        $status = $this->normalizeGatewayStatus((string) ($resolvedPayload['status'] ?? $resolvedPayload['data']['status'] ?? $payload['status'] ?? $payload['data']['status'] ?? 'pending'));
        $previousPaymentStatus = (string) ($payment->order?->payment_status ?? '');
        $payment->update([
            'status' => $status,
            'payload' => $resolvedPayload,
            'verified_at' => now(),
        ]);

        $payment->order?->forceFill([
            'payment_status' => $status,
            'payment_provider' => $provider,
            'payment_reference' => $paymentId,
            'payment_provider_payload' => $resolvedPayload,
        ])->save();

        if ($payment->order) {
            $this->partnerSettlement->settlePaidOrder($payment->order->fresh(['partnerOrder.partner', 'payments']));

            if ($status === 'paid') {
                $this->sendPaymentConfirmedAutomations($payment->order->loadMissing('user'), $previousPaymentStatus !== 'paid');
            }
        }

        Log::channel('payment')->info('payment.webhook.received', [
            'provider' => $provider,
            'payment_id' => $paymentId,
            'status' => $status,
        ]);

        return ['received' => true];
    }

    protected function extractPayPalWebhookOrderId(array $payload): string
    {
        $candidates = [
            $payload['resource']['supplementary_data']['related_ids']['order_id'] ?? null,
            $payload['resource']['resource']['supplementary_data']['related_ids']['order_id'] ?? null,
            $payload['resource']['id'] ?? null,
            $payload['id'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_scalar($candidate) && trim((string) $candidate) !== '') {
                return trim((string) $candidate);
            }
        }

        return '';
    }

    protected function sendPaymentConfirmedAutomations(Order $order, bool $sendEmail): void
    {
        if ($sendEmail) {
            $this->emails->sendPaymentConfirmed($order);
        }

        $this->manychat->sendOrderPaidFlow($order->loadMissing('user'));
    }

    protected function buildGatewayPayload(Order $order, string $provider = 'moneroo'): array
    {
        $freeDeal = is_array($order->meta) && is_array($order->meta['freeDeal'] ?? null)
            ? $order->meta['freeDeal']
            : null;
        $amount = (float) $order->total_price;
        $currency = $order->payment_currency ?? 'XOF';
        $returnUrl = rtrim((string) env('PAYMENT_RETURN_URL', config('services.frontend.url').'/orders'), '/').'?orderId='.$order->id.'&provider='.$provider;
        $cancelUrl = (string) env('PAYMENT_CANCEL_URL', config('services.frontend.url').'/cart');
        $description = 'Paiement commande sourcing '.$order->order_number;

        if ($freeDeal !== null) {
            $amount = (float) ($freeDeal['fixedPriceEur'] ?? 10);
            $currency = 'EUR';
            $returnUrl = rtrim((string) config('services.frontend.url'), '/').'/articles-gratuits/paiement?orderId='.$order->id.'&provider='.$provider;
            $cancelUrl = rtrim((string) config('services.frontend.url'), '/').'/articles-gratuits';
            $description = 'Paiement lot articles gratuits '.$order->order_number;
        }

        $payload = [
            'amount' => $amount,
            'currency' => $currency,
            'description' => $description,
            'return_url' => $returnUrl,
            'cancel_url' => $cancelUrl,
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
        ];

        $methods = config('services.moneroo.methods', []);
        if (is_array($methods) && $methods !== []) {
            $payload['methods'] = $methods;
        }

        return $payload;
    }

    protected function normalizeProvider(string $provider): string
    {
        return in_array($provider, ['moneroo', 'fedapay', 'paypal'], true) ? $provider : 'moneroo';
    }

    protected function normalizeGatewayStatus(string $status): string
    {
        return match (strtolower(trim($status))) {
            '', 'unpaid' => 'unpaid',
            'initiated', 'initialized', 'created' => 'initialized',
            'pending', 'processing', 'in_progress', 'in progress', 'approved', 'payer_action_required' => 'pending',
            'successful', 'success', 'paid', 'completed', 'captured', 'succeeded', 'processed', 'complete' => 'paid',
            'failed', 'error', 'expired', 'declined', 'denied' => 'failed',
            'cancelled', 'canceled', 'voided' => 'cancelled',
            default => 'pending',
        };
    }

    protected function resolvePaymentId(array $payload, Order $order): string
    {
        $candidates = [
            $payload['id'] ?? null,
            $payload['payment_id'] ?? null,
            $payload['paymentId'] ?? null,
            $payload['transaction_id'] ?? null,
            $payload['transactionId'] ?? null,
            $payload['reference'] ?? null,
            $payload['data']['id'] ?? null,
            $payload['data']['payment_id'] ?? null,
            $payload['data']['paymentId'] ?? null,
            $payload['data']['transaction_id'] ?? null,
            $payload['data']['transactionId'] ?? null,
            $payload['data']['reference'] ?? null,
            $payload['data']['payment']['id'] ?? null,
            $payload['data']['payment']['payment_id'] ?? null,
            $payload['data']['payment']['paymentId'] ?? null,
            $payload['data']['payment']['transaction_id'] ?? null,
            $payload['data']['payment']['transactionId'] ?? null,
            $payload['data']['payment']['reference'] ?? null,
            $payload['payment']['id'] ?? null,
            $payload['payment']['payment_id'] ?? null,
            $payload['payment']['paymentId'] ?? null,
            $payload['payment']['transaction_id'] ?? null,
            $payload['payment']['transactionId'] ?? null,
            $payload['payment']['reference'] ?? null,
            $payload['token'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_scalar($candidate) && trim((string) $candidate) !== '') {
                return trim((string) $candidate);
            }
        }

        return 'moneroo_'.$order->id.'_'.Str::uuid()->toString();
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
            $payload['data']['payment']['checkout_url'] ?? null,
            $payload['data']['payment']['checkoutUrl'] ?? null,
            $payload['data']['payment']['payment_url'] ?? null,
            $payload['data']['payment']['paymentUrl'] ?? null,
            $payload['data']['payment']['redirect_url'] ?? null,
            $payload['data']['payment']['redirectUrl'] ?? null,
            $payload['data']['payment']['url'] ?? null,
            $payload['payment']['checkout_url'] ?? null,
            $payload['payment']['checkoutUrl'] ?? null,
            $payload['payment']['payment_url'] ?? null,
            $payload['payment']['paymentUrl'] ?? null,
            $payload['payment']['redirect_url'] ?? null,
            $payload['payment']['redirectUrl'] ?? null,
            $payload['payment']['url'] ?? null,
            $payload['links']['checkout'] ?? null,
            $payload['links']['payment'] ?? null,
            $payload['links']['redirect'] ?? null,
            $payload['approve_link'] ?? null,
            $payload['approveLink'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return $this->findCheckoutUrl($payload);
    }

    protected function findCheckoutUrl($value): ?string
    {
        if (! is_array($value)) {
            return null;
        }

        if (($value['rel'] ?? null) === 'approve' && is_string($value['href'] ?? null) && str_starts_with(trim((string) $value['href']), 'http')) {
            return trim((string) $value['href']);
        }

        foreach ($value as $key => $candidate) {
            $normalizedKey = is_string($key) ? strtolower($key) : '';
            if (is_string($candidate) && trim($candidate) !== '' && str_starts_with(trim($candidate), 'http')) {
                if (preg_match('/checkout|payment|pay|redirect|hosted|url|approve|href/', $normalizedKey) === 1) {
                    return trim($candidate);
                }
            }
        }

        foreach ($value as $candidate) {
            $nested = $this->findCheckoutUrl($candidate);
            if ($nested !== null) {
                return $nested;
            }
        }

        return null;
    }
}
