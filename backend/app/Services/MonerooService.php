<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
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

    protected function bearerClient(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('services.moneroo.base_url', 'https://api.moneroo.io'), '/'))
            ->acceptJson()
            ->asJson()
            ->withToken((string) config('services.moneroo.secret_key'));
    }

    public function initialize(array $payload): array
    {
        $this->assertConfigured();

        try {
            return $this->tryInitializeWithFallbacks($payload);
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
            return $this->tryVerifyWithFallbacks($transactionId);
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

    protected function tryInitializeWithFallbacks(array $payload): array
    {
        $attempts = [
            fn () => $this->client()->post('/payments', $payload),
            fn () => $this->bearerClient()->post('/v1/payments/initialize', $payload),
            fn () => $this->bearerClient()->post('/payments', $payload),
        ];

        $lastException = null;

        foreach ($attempts as $index => $attempt) {
            try {
                $response = $attempt();
                if ($response->successful()) {
                    return $response->json() ?? [];
                }

                if (! $this->shouldFallbackToAlternateProtocol($response, $index < count($attempts) - 1)) {
                    $response->throw();
                }
            } catch (RequestException $exception) {
                $lastException = $exception;
                if (! $this->shouldFallbackFromException($exception, $index < count($attempts) - 1)) {
                    throw $exception;
                }
            }
        }

        if ($lastException instanceof RequestException) {
            throw $lastException;
        }

        throw ValidationException::withMessages([
            'payment' => ['Impossible d initialiser le paiement Moneroo.'],
        ]);
    }

    protected function tryVerifyWithFallbacks(string $transactionId): array
    {
        $attempts = [
            fn () => $this->client()->get("/payments/{$transactionId}"),
            fn () => $this->bearerClient()->get("/v1/payments/{$transactionId}/verify"),
            fn () => $this->bearerClient()->get("/payments/{$transactionId}"),
        ];

        $lastException = null;

        foreach ($attempts as $index => $attempt) {
            try {
                $response = $attempt();
                if ($response->successful()) {
                    return $response->json() ?? [];
                }

                if (! $this->shouldFallbackToAlternateProtocol($response, $index < count($attempts) - 1)) {
                    $response->throw();
                }
            } catch (RequestException $exception) {
                $lastException = $exception;
                if (! $this->shouldFallbackFromException($exception, $index < count($attempts) - 1)) {
                    throw $exception;
                }
            }
        }

        if ($lastException instanceof RequestException) {
            throw $lastException;
        }

        throw ValidationException::withMessages([
            'payment' => ['Impossible de verifier le paiement Moneroo.'],
        ]);
    }

    protected function shouldFallbackToAlternateProtocol(?Response $response, bool $hasAlternateAttempt): bool
    {
        if (! $hasAlternateAttempt || ! $response) {
            return false;
        }

        if (in_array($response->status(), [401, 403, 404, 405, 415, 422], true)) {
            return true;
        }

        $payload = $response->json();
        $message = is_array($payload)
            ? strtolower(trim((string) ($payload['message'] ?? $payload['error'] ?? $payload['detail'] ?? '')))
            : '';

        return str_contains($message, 'unauthorized')
            || str_contains($message, 'invalid api key')
            || str_contains($message, 'not found')
            || str_contains($message, 'route')
            || str_contains($message, 'endpoint');
    }

    protected function shouldFallbackFromException(RequestException $exception, bool $hasAlternateAttempt): bool
    {
        return $hasAlternateAttempt && $this->shouldFallbackToAlternateProtocol($exception->response, true);
    }
}
