<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class ManyChatService
{
    public function sendOrderPaidFlow(Order $order): bool
    {
        $meta = is_array($order->meta) ? $order->meta : [];
        $manychat = $this->resolveManyChatContext($order);
        $apiKey = trim((string) config('services.manychat.api_key'));

        if ($apiKey === '') {
            $this->logSkipped($order, 'missing_api_key');

            return false;
        }

        if (($manychat['subscriberId'] ?? '') === '') {
            $this->logSkipped($order, 'missing_subscriber_id');

            return false;
        }

        if (($manychat['orderConfirmationSentAt'] ?? '') !== '') {
            $this->logSkipped($order, 'already_sent');

            return false;
        }

        $subscriberId = (string) $manychat['subscriberId'];
        $flowId = (string) (($manychat['flowId'] ?? '') ?: config('services.manychat.order_confirmation_flow_id', ''));
        $paidTagId = (string) (($manychat['paidTagId'] ?? '') ?: config('services.manychat.paid_tag_id', ''));

        try {
            $this->setConfiguredCustomFields($subscriberId, $order);

            if ($paidTagId !== '') {
                $this->post('/fb/subscriber/addTag', [
                    'subscriber_id' => $subscriberId,
                    'tag_id' => ctype_digit($paidTagId) ? (int) $paidTagId : $paidTagId,
                ]);
            }

            $flowResponse = null;
            if ($flowId !== '') {
                $flowResponse = $this->post('/fb/sending/sendFlow', [
                    'subscriber_id' => $subscriberId,
                    'flow_ns' => $flowId,
                ]);
            }

            $meta['manychat'] = [
                ...$manychat,
                'subscriberId' => $subscriberId,
                'flowId' => $flowId ?: ($manychat['flowId'] ?? null),
                'paidTagId' => $paidTagId ?: ($manychat['paidTagId'] ?? null),
                'orderConfirmationSentAt' => now()->toIso8601String(),
                'lastFlowResponse' => $flowResponse,
            ];
            $order->forceFill(['meta' => $meta])->save();

            Log::info('manychat.order_paid.sent', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'subscriber_id' => $subscriberId,
                'flow_id' => $flowId ?: null,
            ]);

            return true;
        } catch (Throwable $exception) {
            Log::warning('manychat.order_paid.failed', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'subscriber_id' => $subscriberId,
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    public function sendLogisticsUpdate(Order $order, string $title, ?string $detail = null): bool
    {
        $meta = is_array($order->meta) ? $order->meta : [];
        $manychat = $this->resolveManyChatContext($order);
        $apiKey = trim((string) config('services.manychat.api_key'));
        $subscriberId = (string) ($manychat['subscriberId'] ?? '');
        $normalizedTitle = trim($title);

        if ($apiKey === '') {
            $this->logSkipped($order, 'missing_api_key');

            return false;
        }

        if ($subscriberId === '' || $normalizedTitle === '') {
            $this->logSkipped($order, 'missing_logistics_context');

            return false;
        }

        try {
            $trackingCode = $this->buildTrackingCode($order);
            $this->setConfiguredCustomFields($subscriberId, $order);
            $this->setConfiguredLogisticsCustomFields($subscriberId, $trackingCode, $normalizedTitle);

            $response = $this->post('/fb/sending/sendContent', [
                'subscriber_id' => $subscriberId,
                'data' => [
                    'text' => $this->buildLogisticsMessage($order, $normalizedTitle, $detail),
                ],
                'message_tag' => trim((string) config('services.manychat.default_message_tag', 'ACCOUNT_UPDATE')) ?: 'ACCOUNT_UPDATE',
            ]);

            $meta['manychat'] = [
                ...$manychat,
                'subscriberId' => $subscriberId,
                'logisticsLastSentAt' => now()->toIso8601String(),
                'logisticsLastStatusSent' => $normalizedTitle,
                'lastLogisticsResponse' => $response,
            ];

            $order->forceFill(['meta' => $meta])->save();

            Log::info('manychat.logistics.sent', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'subscriber_id' => $subscriberId,
                'title' => $normalizedTitle,
            ]);

            return true;
        } catch (Throwable $exception) {
            Log::warning('manychat.logistics.failed', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'subscriber_id' => $subscriberId,
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    protected function resolveManyChatContext(Order $order): array
    {
        $meta = is_array($order->meta) ? $order->meta : [];
        $manychat = is_array($meta['manychat'] ?? null) ? $meta['manychat'] : [];
        $settings = is_array($order->user?->settings) ? $order->user->settings : [];

        return [
            ...$manychat,
            'subscriberId' => $this->normalizeOptionalString($manychat['subscriberId'] ?? $settings['manychatSubscriberId'] ?? null),
            'flowId' => $this->normalizeOptionalString($manychat['flowId'] ?? $settings['manychatFlowId'] ?? null),
            'paidTagId' => $this->normalizeOptionalString($manychat['paidTagId'] ?? $settings['manychatPaidTagId'] ?? null),
            'orderConfirmationSentAt' => $this->normalizeOptionalString($manychat['orderConfirmationSentAt'] ?? null),
        ];
    }

    protected function setConfiguredCustomFields(string $subscriberId, Order $order): void
    {
        $fields = [
            'product_id_field' => $this->buildProductsLabel($order),
            'amount_field' => (int) round((float) $order->total_price),
            'order_number_field' => (string) $order->order_number,
            'shipping_method_field' => (string) $order->shipping_method,
        ];

        foreach ($fields as $configKey => $value) {
            $fieldId = trim((string) config('services.manychat.'.$configKey));
            if ($fieldId === '' || $value === '') {
                continue;
            }

            $this->post('/fb/subscriber/setCustomField', [
                'subscriber_id' => $subscriberId,
                'field_id' => ctype_digit($fieldId) ? (int) $fieldId : $fieldId,
                'field_value' => $value,
            ]);
        }
    }

    protected function setConfiguredLogisticsCustomFields(string $subscriberId, ?string $trackingCode, string $statusLabel): void
    {
        $fields = [
            'tracking_code_field' => $trackingCode,
            'logistics_status_field' => $statusLabel,
        ];

        foreach ($fields as $configKey => $value) {
            $fieldId = trim((string) config('services.manychat.'.$configKey));
            if ($fieldId === '' || $value === null || $value === '') {
                continue;
            }

            $this->post('/fb/subscriber/setCustomField', [
                'subscriber_id' => $subscriberId,
                'field_id' => ctype_digit($fieldId) ? (int) $fieldId : $fieldId,
                'field_value' => $value,
            ]);
        }
    }

    protected function buildProductsLabel(Order $order): string
    {
        return collect($order->items ?? [])
            ->map(fn (array $item) => trim((string) ($item['title'] ?? $item['productName'] ?? 'Produit')).' x'.(int) ($item['quantity'] ?? 1))
            ->filter()
            ->join(', ');
    }

    protected function buildTrackingCode(Order $order): ?string
    {
        $base = preg_replace('/[^A-Z0-9]+/i', '', (string) $order->order_number);
        $base = strtoupper(substr((string) $base, -10));

        return $base !== '' ? 'AFP-'.$base : null;
    }

    protected function buildLogisticsMessage(Order $order, string $title, ?string $detail = null): string
    {
        $trackingCode = $this->buildTrackingCode($order);
        $lines = array_values(array_filter([
            'AfriPay - Mise a jour logistique',
            'Commande: '.(string) $order->order_number,
            'Statut: '.$title,
            $trackingCode ? 'Tracking: '.$trackingCode : null,
            $detail ? trim($detail) : null,
        ], fn ($entry) => is_string($entry) && trim($entry) !== ''));

        return implode("\n", $lines);
    }

    protected function post(string $path, array $payload): array
    {
        $baseUrl = rtrim((string) config('services.manychat.base_url', 'https://api.manychat.com'), '/');
        $response = Http::timeout(15)
            ->acceptJson()
            ->withToken((string) config('services.manychat.api_key'))
            ->post($baseUrl.$path, $payload);

        $decoded = $response->json();
        if (! $response->successful() || (is_array($decoded) && ($decoded['status'] ?? null) === 'error')) {
            $message = is_array($decoded) && is_string($decoded['message'] ?? null)
                ? $decoded['message']
                : 'ManyChat request failed with status '.$response->status();
            throw new \RuntimeException($message);
        }

        return is_array($decoded) ? $decoded : [];
    }

    protected function normalizeOptionalString(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }

    protected function logSkipped(Order $order, string $reason): void
    {
        Log::info('manychat.order_paid.skipped', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'reason' => $reason,
        ]);
    }
}
