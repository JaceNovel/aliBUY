<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class MonerooService
{
    protected function client(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) env('MONEROO_API_BASE_URL', 'https://api.moneroo.io'), '/'))
            ->acceptJson()
            ->asJson()
            ->withHeaders([
                'x-api-key' => (string) env('MONEROO_API_KEY'),
                'x-api-secret' => (string) env('MONEROO_SECRET'),
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
        $secret = (string) env('MONEROO_SECRET');

        if ($secret === '' || $signature === '') {
            return false;
        }

        $expected = hash_hmac('sha256', $body, $secret);

        return hash_equals($expected, $signature);
    }
}
