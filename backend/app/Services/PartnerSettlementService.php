<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderTracking;
use App\Models\PartnerOrder;
use App\Models\PartnerTransaction;
use App\Models\PartnerWallet;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PartnerSettlementService
{
    public function settlePaidOrder(Order $order): void
    {
        if ($order->payment_status !== 'paid') {
            return;
        }

        $partnerOrder = null;
        $shouldDispatchPaidUpdate = false;

        DB::transaction(function () use ($order, &$partnerOrder, &$shouldDispatchPaidUpdate) {
            $partnerOrder = PartnerOrder::query()
                ->with('partner')
                ->where('order_id', $order->id)
                ->lockForUpdate()
                ->first();

            if (! $partnerOrder || $partnerOrder->status === 'paid') {
                return;
            }

            $existingCredit = PartnerTransaction::query()
                ->where('partner_order_id', $partnerOrder->id)
                ->where('type', 'credit')
                ->exists();

            $wallet = PartnerWallet::query()->firstOrCreate(
                ['partner_id' => $partnerOrder->partner_id],
                ['balance' => 0]
            );

            if (! $existingCredit) {
                $wallet->forceFill([
                    'balance' => (float) $wallet->balance + (float) $partnerOrder->margin,
                ])->save();

                PartnerTransaction::query()->create([
                    'partner_id' => $partnerOrder->partner_id,
                    'order_id' => $order->id,
                    'partner_order_id' => $partnerOrder->id,
                    'amount' => $partnerOrder->margin,
                    'type' => 'credit',
                    'description' => 'Commission creditee pour la commande '.$order->order_number,
                ]);
            }

            $order->forceFill(['status' => 'paid'])->save();
            $partnerOrder->forceFill(['status' => 'paid'])->save();
            $shouldDispatchPaidUpdate = true;
        });

        if (! $shouldDispatchPaidUpdate) {
            return;
        }

        OrderTracking::query()->create([
            'order_id' => $order->id,
            'status' => 'paid',
            'description' => 'Paiement confirme et commission creditee au partenaire.',
        ]);

        if ($partnerOrder && $partnerOrder->partner?->webhook_url) {
            $this->dispatchWebhook($partnerOrder, 'order.paid');
        }
    }

    public function dispatchOrderUpdatedWebhook(Order $order): void
    {
        $partnerOrder = $order->partnerOrder()->with('partner')->first();

        if (! $partnerOrder || ! $partnerOrder->partner?->webhook_url) {
            return;
        }

        $this->dispatchWebhook($partnerOrder, 'order.updated');
    }

    protected function dispatchWebhook(PartnerOrder $partnerOrder, string $event): void
    {
        try {
            Http::acceptJson()
                ->asJson()
                ->timeout(10)
                ->post($partnerOrder->partner->webhook_url, [
                    'event' => $event,
                    'order_id' => (string) ($partnerOrder->order?->order_number ?? $partnerOrder->order_id),
                    'status' => $partnerOrder->status,
                    'margin' => (float) $partnerOrder->margin,
                ])
                ->throw();
        } catch (\Throwable $exception) {
            Log::warning('partner.webhook.failed', [
                'partner_id' => $partnerOrder->partner_id,
                'order_id' => $partnerOrder->order_id,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
