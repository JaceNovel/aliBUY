<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class FedaPayService
{
    protected function client(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('services.fedapay.base_url', 'https://api.fedapay.com/v1'), '/'))
            ->acceptJson()
            ->asJson()
            ->withToken((string) config('services.fedapay.secret_key'));
    }

    public function initialize(array $payload): array
    {
        return $this->client()->post('/transactions', $payload)->throw()->json();
    }

    public function verify(string $transactionId): array
    {
        return $this->client()->get('/transactions/'.$transactionId)->throw()->json();
    }

    public function isValidWebhookSignature(string $signature, string $body): bool
    {
        $secret = (string) config('services.fedapay.webhook_secret');

        if ($secret === '' || $signature === '') {
            return false;
        }

        $expected = hash_hmac('sha256', $body, $secret);

        return hash_equals($expected, $signature);
    }
}