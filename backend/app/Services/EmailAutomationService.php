<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class EmailAutomationService
{
    public function sendOrderCreated(Order $order): bool
    {
        return $this->sendOrderEmail(
            $order,
            'Commande creee '.$order->order_number,
            sprintf(
                "Bonjour %s,\n\nVotre commande %s est creee.\nFinalisez le paiement depuis votre espace commandes pour lancer le traitement.\n\nAfriPay",
                $order->customer_name,
                $order->order_number
            ),
            'order.created'
        );
    }

    public function sendPaymentInitialized(Order $order): bool
    {
        return $this->sendOrderEmail(
            $order,
            'Paiement a finaliser '.$order->order_number,
            sprintf(
                "Bonjour %s,\n\nLe paiement de la commande %s est pret.\nOuvrez votre espace commandes pour terminer le paiement.\n\nAfriPay",
                $order->customer_name,
                $order->order_number
            ),
            'payment.initialized'
        );
    }

    public function sendPaymentConfirmed(Order $order): bool
    {
        return $this->sendOrderEmail(
            $order,
            'Paiement confirme '.$order->order_number,
            sprintf(
                "Bonjour %s,\n\nVotre paiement pour la commande %s est confirme.\nLa preparation logistique demarre et vous recevrez les mises a jour importantes par email.\n\nAfriPay",
                $order->customer_name,
                $order->order_number
            ),
            'payment.confirmed'
        );
    }

    public function sendTrackingUpdate(Order $order, string $status, string $description): bool
    {
        return $this->sendOrderEmail(
            $order,
            'Mise a jour commande '.$order->order_number,
            sprintf(
                "Bonjour %s,\n\nMise a jour pour la commande %s: %s.\n%s\n\nAfriPay",
                $order->customer_name,
                $order->order_number,
                $this->statusLabel($status),
                $description
            ),
            'order.tracking_updated'
        );
    }

    protected function sendOrderEmail(Order $order, string $subject, string $body, string $event): bool
    {
        $email = trim((string) $order->customer_email);
        if ($email === '') {
            Log::info('email_automation.skipped.no_email', [
                'event' => $event,
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ]);

            return false;
        }

        if (! $this->allowsEmail($order->user, 'emailOrderUpdates')) {
            Log::info('email_automation.skipped.preference_disabled', [
                'event' => $event,
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ]);

            return false;
        }

        if (! (bool) config('services.email_automation.enabled', true)) {
            Log::info('email_automation.disabled', [
                'to' => $email,
                'subject' => $subject,
                'event' => $event,
            ]);

            return false;
        }

        try {
            Mail::raw($body, function ($message) use ($email, $subject) {
                $message->to($email)->subject($subject);
            });

            Log::info('email_automation.sent', [
                'to' => $email,
                'subject' => $subject,
                'event' => $event,
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ]);

            return true;
        } catch (Throwable $exception) {
            Log::warning('email_automation.failed', [
                'to' => $email,
                'subject' => $subject,
                'event' => $event,
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    protected function allowsEmail(?User $user, string $preferenceKey): bool
    {
        if (! $user) {
            return true;
        }

        $settings = is_array($user->settings) ? $user->settings : [];
        if (! array_key_exists($preferenceKey, $settings)) {
            return true;
        }

        return (bool) $settings[$preferenceKey];
    }

    protected function statusLabel(string $status): string
    {
        return match ($status) {
            'processing' => 'preparation',
            'shipped' => 'expedition',
            'delivered' => 'livree',
            'cancelled' => 'annulee',
            default => $status,
        };
    }
}
