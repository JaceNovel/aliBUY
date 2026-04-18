<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

class EbayWebhookController extends Controller
{
    public function challenge(Request $request): JsonResponse
    {
        $challengeCode = trim((string) $request->query('challenge_code', ''));
        if ($challengeCode === '') {
            throw new HttpException(400, 'challenge_code is required.');
        }

        $verificationToken = trim((string) config('services.ebay.verification_token'));
        $endpoint = trim((string) config('services.ebay.notification_endpoint', $request->url()));

        if ($verificationToken === '') {
            throw new HttpException(500, 'eBay verification token is not configured.');
        }

        if (! preg_match('/^[A-Za-z0-9_-]{32,80}$/', $verificationToken)) {
            throw new HttpException(500, 'eBay verification token format is invalid.');
        }

        if ($endpoint === '' || ! str_starts_with($endpoint, 'https://')) {
            throw new HttpException(500, 'eBay notification endpoint must be configured as an HTTPS URL.');
        }

        return response()->json([
            'challengeResponse' => hash('sha256', $challengeCode.$verificationToken.$endpoint),
        ]);
    }

    public function notify(Request $request): JsonResponse
    {
        $payload = $request->json()->all();
        $notificationId = data_get($payload, 'notification.notificationId');
        $topic = data_get($payload, 'metadata.topic');
        $userId = data_get($payload, 'notification.data.userId');
        $username = data_get($payload, 'notification.data.username');
        $eiasToken = data_get($payload, 'notification.data.eiasToken');

        Log::info('ebay.marketplace_account_deletion.received', [
            'notification_id' => $notificationId,
            'topic' => $topic,
            'user_id' => $userId,
            'username' => $username,
            'eias_token_suffix' => is_string($eiasToken) && strlen($eiasToken) > 6 ? substr($eiasToken, -6) : $eiasToken,
            'publish_attempt_count' => data_get($payload, 'notification.publishAttemptCount'),
        ]);

        return response()->json([
            'acknowledged' => true,
        ], 200);
    }
}
