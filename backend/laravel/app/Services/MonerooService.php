<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

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
        return $this->client()->post('/payments', $payload)->throw()->json();
    }

    public function verify(string $transactionId): array
    {
        return $this->client()->get("/payments/{$transactionId}")->throw()->json();
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
}
