<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class MonerooService
{
    protected function client(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('services.moneroo.base_url', 'https://api.moneroo.io'), '/'))
            ->acceptJson()
            ->asJson()
            ->withHeaders([
                'x-api-key' => (string) config('services.moneroo.api_key'),
                'x-api-secret' => (string) config('services.moneroo.secret_key'),
            ]);
    }

    public function initialize(array $payload): array
    {
        $this->assertConfigured();

        try {
            return $this->client()->post('/payments', $payload)->throw()->json();
        } catch (RequestException $exception) {
            throw ValidationException::withMessages([
                'payment' => [$this->extractGatewayErrorMessage($exception)],
            ]);
        }
    }

    public function verify(string $transactionId): array
    {
        $this->assertConfigured();

        try {
            return $this->client()->get("/payments/{$transactionId}")->throw()->json();
        } catch (RequestException $exception) {
            throw ValidationException::withMessages([
                'payment' => [$this->extractGatewayErrorMessage($exception)],
            ]);
        }
    }

    public function isValidWebhookSignature(string $signature, string $body): bool
    {
        $secret = (string) config('services.moneroo.webhook_secret');

        if ($secret === '' || $signature === '') {
            return false;
        }

        $expected = hash_hmac('sha256', $body, $secret);

        return hash_equals($expected, $signature);
    }

    protected function assertConfigured(): void
    {
        $apiKey = trim((string) config('services.moneroo.api_key'));
        $secretKey = trim((string) config('services.moneroo.secret_key'));

        if ($apiKey === '' || $secretKey === '') {
            throw ValidationException::withMessages([
                'payment' => ['Les identifiants Moneroo ne sont pas configures sur le backend.'],
            ]);
        }
    }

    protected function extractGatewayErrorMessage(RequestException $exception): string
    {
        $response = $exception->response;
        $payload = $response?->json();

        if (is_array($payload)) {
            $message = $payload['message'] ?? $payload['error'] ?? $payload['detail'] ?? null;
            if (is_string($message) && trim($message) !== '') {
                return trim($message);
            }

            if (is_array($payload['errors'] ?? null)) {
                foreach ($payload['errors'] as $entry) {
                    if (is_string($entry) && trim($entry) !== '') {
                        return trim($entry);
                    }

                    if (is_array($entry)) {
                        foreach ($entry as $nested) {
                            if (is_string($nested) && trim($nested) !== '') {
                                return trim($nested);
                            }
                        }
                    }
                }
            }
        }

        $body = trim((string) $response?->body());
        if ($body !== '') {
            return $body;
        }

        return 'Le paiement Moneroo a echoue.';
    }
}
