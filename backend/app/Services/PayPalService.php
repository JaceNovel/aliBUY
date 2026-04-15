<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class PayPalService
{
    public function initialize(array $payload): array
    {
        $this->assertConfigured();

        try {
            $response = $this->client()
                ->withHeaders([
                    'PayPal-Request-Id' => 'afripay-create-'.Str::uuid()->toString(),
                ])
                ->post('/v2/checkout/orders', $this->buildCreateOrderPayload($payload))
                ->throw();

            return $response->json() ?? [];
        } catch (RequestException $exception) {
            throw ValidationException::withMessages([
                'payment' => [$this->extractGatewayErrorMessage($exception)],
            ]);
        } catch (Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'payment' => ['PayPal est momentanement indisponible ou mal configure. Verifiez les identifiants PayPal puis reessayez.'],
            ]);
        }
    }

    public function verify(string $orderId): array
    {
        $this->assertConfigured();

        try {
            $order = $this->showOrder($orderId);
            $status = strtoupper((string) ($order['status'] ?? ''));

            if ($status === 'APPROVED') {
                return $this->captureOrder($orderId);
            }

            return $order;
        } catch (RequestException $exception) {
            throw ValidationException::withMessages([
                'payment' => [$this->extractGatewayErrorMessage($exception)],
            ]);
        } catch (Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'payment' => ['Impossible de verifier le paiement PayPal pour le moment.'],
            ]);
        }
    }

    public function isValidWebhookSignature(array $headers, string $body, array $eventPayload): bool
    {
        $this->assertConfigured();

        $webhookId = trim((string) config('services.paypal.webhook_id'));
        if ($webhookId === '') {
            return false;
        }

        $transmissionId = trim((string) ($headers['paypal-transmission-id'] ?? ''));
        $transmissionTime = trim((string) ($headers['paypal-transmission-time'] ?? ''));
        $transmissionSig = trim((string) ($headers['paypal-transmission-sig'] ?? ''));
        $certUrl = trim((string) ($headers['paypal-cert-url'] ?? ''));
        $authAlgo = trim((string) ($headers['paypal-auth-algo'] ?? ''));

        if ($transmissionId === '' || $transmissionTime === '' || $transmissionSig === '' || $certUrl === '' || $authAlgo === '') {
            return false;
        }

        try {
            $response = $this->client()
                ->post('/v1/notifications/verify-webhook-signature', [
                    'auth_algo' => $authAlgo,
                    'cert_url' => $certUrl,
                    'transmission_id' => $transmissionId,
                    'transmission_sig' => $transmissionSig,
                    'transmission_time' => $transmissionTime,
                    'webhook_id' => $webhookId,
                    'webhook_event' => $eventPayload,
                ]);

            if (! $response->successful()) {
                return false;
            }

            return strtoupper(trim((string) ($response->json('verification_status') ?? ''))) === 'SUCCESS';
        } catch (Throwable) {
            return false;
        }
    }

    protected function client(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('services.paypal.base_url', 'https://api-m.paypal.com'), '/'))
            ->acceptJson()
            ->asJson()
            ->withToken($this->getAccessToken());
    }

    protected function tokenClient(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('services.paypal.base_url', 'https://api-m.paypal.com'), '/'))
            ->acceptJson()
            ->asForm()
            ->withBasicAuth(
                (string) config('services.paypal.client_id'),
                (string) config('services.paypal.client_secret'),
            );
    }

    protected function getAccessToken(): string
    {
        $response = $this->tokenClient()
            ->post('/v1/oauth2/token', [
                'grant_type' => 'client_credentials',
            ])
            ->throw();

        $token = trim((string) ($response->json('access_token') ?? ''));
        if ($token === '') {
            throw ValidationException::withMessages([
                'payment' => ['PayPal n a pas retourne de jeton d acces valide.'],
            ]);
        }

        return $token;
    }

    protected function showOrder(string $orderId): array
    {
        return $this->client()
            ->get('/v2/checkout/orders/'.$orderId)
            ->throw()
            ->json() ?? [];
    }

    protected function captureOrder(string $orderId): array
    {
        return $this->client()
            ->withHeaders([
                'PayPal-Request-Id' => 'afripay-capture-'.$orderId,
            ])
            ->post('/v2/checkout/orders/'.$orderId.'/capture', [])
            ->throw()
            ->json() ?? [];
    }

    protected function buildCreateOrderPayload(array $payload): array
    {
        [$currencyCode, $value] = $this->resolveChargeAmount(
            (float) ($payload['amount'] ?? 0),
            (string) ($payload['currency'] ?? 'XOF'),
        );

        $metadata = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [];
        $description = trim((string) ($payload['description'] ?? 'Paiement AfriPay'));

        return [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => (string) ($metadata['orderNumber'] ?? $metadata['orderId'] ?? Str::uuid()->toString()),
                'custom_id' => (string) ($metadata['orderId'] ?? ''),
                'description' => $description,
                'amount' => [
                    'currency_code' => $currencyCode,
                    'value' => $value,
                ],
            ]],
            'payment_source' => [
                'paypal' => [
                    'experience_context' => [
                        'brand_name' => 'AfriPay',
                        'landing_page' => 'LOGIN',
                        'user_action' => 'PAY_NOW',
                        'return_url' => (string) ($payload['return_url'] ?? ''),
                        'cancel_url' => (string) ($payload['cancel_url'] ?? ''),
                    ],
                ],
            ],
        ];
    }

    protected function resolveChargeAmount(float $amount, string $currency): array
    {
        $normalizedCurrency = strtoupper(trim($currency));

        if ($normalizedCurrency === 'XOF') {
            $fallbackCurrency = strtoupper(trim((string) config('services.paypal.fallback_currency', 'EUR')));
            $rate = (float) config('services.paypal.xof_per_eur', 655.957);

            if ($fallbackCurrency === '' || $rate <= 0) {
                throw ValidationException::withMessages([
                    'payment' => ['PayPal ne peut pas encaisser le XOF sans devise de conversion configuree.'],
                ]);
            }

            return [$fallbackCurrency, number_format($amount / $rate, 2, '.', '')];
        }

        return [$normalizedCurrency !== '' ? $normalizedCurrency : 'EUR', number_format($amount, 2, '.', '')];
    }

    protected function assertConfigured(): void
    {
        if (trim((string) config('services.paypal.client_id')) === '' || trim((string) config('services.paypal.client_secret')) === '') {
            throw ValidationException::withMessages([
                'payment' => ['Les identifiants PayPal ne sont pas configures sur le backend.'],
            ]);
        }
    }

    protected function extractGatewayErrorMessage(RequestException $exception): string
    {
        $payload = $exception->response?->json();

        if (is_array($payload)) {
            $message = $payload['message'] ?? $payload['error_description'] ?? $payload['error'] ?? null;
            if (is_string($message) && trim($message) !== '') {
                return trim($message);
            }

            if (is_array($payload['details'] ?? null)) {
                foreach ($payload['details'] as $detail) {
                    if (! is_array($detail)) {
                        continue;
                    }

                    foreach (['description', 'issue'] as $key) {
                        $value = $detail[$key] ?? null;
                        if (is_string($value) && trim($value) !== '') {
                            return trim($value);
                        }
                    }
                }
            }
        }

        return 'Le paiement PayPal a echoue.';
    }
}