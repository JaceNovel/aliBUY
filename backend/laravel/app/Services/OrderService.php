<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class OrderService
{
    public function indexForUser(?User $user, Request $request): array
    {
        $orders = Order::query()
            ->with('payments')
            ->when($user, function ($builder) use ($user) {
                $builder->where(function ($nested) use ($user) {
                    $nested->where('user_id', $user->id)
                        ->orWhere('customer_email', $user->email);
                });
            })
            ->latest()
            ->limit(min(max((int) $request->integer('limit', 50), 1), 100))
            ->get();

        return $orders->map(fn (Order $order) => $this->transformOrder($order))->values()->all();
    }

    public function store(array $validated, ?User $user): Order
    {
        $items = collect($validated['items'] ?? [])->map(function (array $item) {
            return [
                'slug' => $item['slug'] ?? null,
                'title' => $item['title'] ?? $item['productName'] ?? 'Produit',
                'productName' => $item['productName'] ?? $item['title'] ?? 'Produit',
                'image' => $item['image'] ?? '/globe.svg',
                'quantity' => (int) ($item['quantity'] ?? 1),
                'finalLinePriceFcfa' => (float) ($item['finalLinePriceFcfa'] ?? 0),
            ];
        })->values()->all();

        $totalPrice = collect($items)->sum(fn (array $item) => (float) ($item['finalLinePriceFcfa'] ?? 0));
        $promoCode = isset($validated['promoCode']) ? strtoupper((string) $validated['promoCode']) : null;

        return Order::query()->create([
            'user_id' => $user?->id,
            'order_number' => 'AFR-'.strtoupper(Str::random(10)),
            'customer_name' => $validated['customerName'],
            'customer_email' => $validated['customerEmail'],
            'customer_phone' => $validated['customerPhone'] ?? null,
            'user_info' => [
                'userId' => $user?->id,
                'customerName' => $validated['customerName'],
                'customerEmail' => $validated['customerEmail'],
                'customerPhone' => $validated['customerPhone'] ?? null,
            ],
            'address_line1' => $validated['addressLine1'] ?? null,
            'address_line2' => $validated['addressLine2'] ?? null,
            'city' => $validated['city'] ?? null,
            'state' => $validated['state'] ?? null,
            'postal_code' => $validated['postalCode'] ?? null,
            'country_code' => $validated['countryCode'],
            'items' => $items,
            'total_price' => $totalPrice,
            'status' => 'checkout_created',
            'payment_status' => 'unpaid',
            'payment_currency' => 'XOF',
            'payment_provider' => 'moneroo',
            'shipping_method' => $validated['shippingMethod'],
            'meta' => [
                'promo' => $promoCode ? [
                    'code' => $promoCode,
                    'discountFcfa' => 0,
                    'baseTotalFcfa' => $totalPrice,
                    'finalTotalFcfa' => $totalPrice,
                ] : null,
                'paymentMethod' => $validated['paymentMethod'] ?? 'card',
                'notes' => $validated['notes'] ?? null,
            ],
        ])->fresh(['payments']);
    }

    public function applyPromo(Order $order, string $code): array
    {
        $baseTotal = (float) $order->total_price;
        $discount = 0.0;
        $finalTotal = $baseTotal;
        $promoCode = strtoupper(trim($code));

        $order->meta = array_merge($order->meta ?? [], [
            'promo' => [
                'code' => $promoCode,
                'discountFcfa' => $discount,
                'baseTotalFcfa' => $baseTotal,
                'finalTotalFcfa' => $finalTotal,
            ],
        ]);
        $order->save();

        return [
            'order' => $this->transformOrder($order->fresh('payments')),
            'promoCode' => $promoCode,
            'promoDiscountLabel' => number_format($discount, 0, ',', ' ').' FCFA',
            'originalTotal' => number_format($baseTotal, 0, ',', ' ').' FCFA',
            'total' => number_format($finalTotal, 0, ',', ' ').' FCFA',
        ];
    }

    public function assertVisibleToUser(Order $order, ?User $user): void
    {
        if (! $user) {
            throw new AuthorizationException('Connexion requise.');
        }

        if ($order->user_id === $user->id || strcasecmp((string) $order->customer_email, (string) $user->email) === 0) {
            return;
        }

        throw new AuthorizationException('Acces refuse.');
    }

    public function transformOrder(Order $order): array
    {
        $payment = $order->relationLoaded('payments')
            ? $order->payments->sortByDesc('id')->first()
            : $order->payments()->latest()->first();
        $items = collect($order->items ?? [])->map(fn (array $item) => [
            'slug' => $item['slug'] ?? null,
            'title' => $item['title'] ?? $item['productName'] ?? 'Produit',
            'productName' => $item['productName'] ?? $item['title'] ?? 'Produit',
            'image' => $item['image'] ?? '/globe.svg',
            'quantity' => (int) ($item['quantity'] ?? 1),
            'finalLinePriceFcfa' => (int) round((float) ($item['finalLinePriceFcfa'] ?? 0)),
        ])->values();

        return [
            'id' => (string) $order->id,
            'orderNumber' => (string) $order->order_number,
            'userId' => $order->user_id ? (string) $order->user_id : null,
            'customerEmail' => (string) $order->customer_email,
            'customerName' => (string) $order->customer_name,
            'customerPhone' => (string) ($order->customer_phone ?? ''),
            'addressLine1' => $order->address_line1,
            'addressLine2' => $order->address_line2,
            'city' => $order->city,
            'state' => $order->state,
            'postalCode' => $order->postal_code,
            'countryCode' => $order->country_code,
            'shippingMethod' => (string) $order->shipping_method,
            'status' => (string) $order->status,
            'totalPriceFcfa' => (int) round((float) $order->total_price),
            'paymentStatus' => (string) $order->payment_status,
            'paymentCurrency' => (string) ($order->payment_currency ?? 'XOF'),
            'paymentProvider' => (string) ($order->payment_provider ?? 'moneroo'),
            'monerooPaymentId' => $order->payment_reference ?? $payment?->transaction_id,
            'monerooCheckoutUrl' => $order->payment_checkout_url ?? $payment?->checkout_url,
            'monerooPaymentStatus' => $payment?->status ?? $order->payment_status,
            'createdAt' => optional($order->created_at)->toIso8601String(),
            'updatedAt' => optional($order->updated_at)->toIso8601String(),
            'items' => $items,
            'meta' => $order->meta,
        ];
    }
}