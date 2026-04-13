<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    protected const PAY_ON_DELIVERY_LIMIT_FCFA = 30000;

    public function __construct(
        protected SourcingQuoteService $quotes,
        protected EmailAutomationService $emails,
    ) {
    }

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
        $requestItems = collect($validated['items'] ?? [])->map(function (array $item) {
            return [
                'slug' => $item['slug'] ?? null,
                'title' => $item['title'] ?? $item['productName'] ?? 'Produit',
                'productName' => $item['productName'] ?? $item['title'] ?? 'Produit',
                'image' => $item['image'] ?? '/globe.svg',
                'quantity' => (int) ($item['quantity'] ?? 1),
                'selectedVariants' => is_array($item['selectedVariants'] ?? null) ? $item['selectedVariants'] : null,
                'finalLinePriceFcfa' => (float) ($item['finalLinePriceFcfa'] ?? 0),
            ];
        })->values()->all();

        $deliveryMode = (($validated['deliveryProfile']['mode'] ?? null) === 'forwarder') ? 'forwarder' : 'direct';
        $quote = $this->quotes->buildQuote($requestItems, [
            'deliveryMode' => $deliveryMode,
        ]);
        $shippingMethod = (string) ($validated['shippingMethod'] ?? 'air');
        $shippingOption = collect($quote['shippingOptions'] ?? [])->first(fn (array $option) => (string) ($option['key'] ?? '') === $shippingMethod);
        if ($shippingOption === null) {
            throw ValidationException::withMessages([
                'shippingMethod' => ['Le mode de livraison selectionne n\'est pas disponible pour cette commande.'],
            ]);
        }

        $quotedItemsBySlug = collect($quote['items'] ?? [])->keyBy(function (array $item) {
            $slug = (string) ($item['slug'] ?? '');
            $selectedVariants = is_array($item['selectedVariants'] ?? null) ? $item['selectedVariants'] : null;
            if (! $selectedVariants) {
                return $slug;
            }

            ksort($selectedVariants);

            return $slug.'::'.json_encode($selectedVariants);
        });

        $items = collect($requestItems)->map(function (array $item) use ($quotedItemsBySlug) {
            $slug = (string) ($item['slug'] ?? '');
            $selectedVariants = is_array($item['selectedVariants'] ?? null) ? $item['selectedVariants'] : null;
            $lookupKey = $slug;
            if ($selectedVariants) {
                ksort($selectedVariants);
                $lookupKey .= '::'.json_encode($selectedVariants);
            }

            $quoted = $quotedItemsBySlug->get($lookupKey);
            $finalLinePrice = (float) ($quoted['finalLinePriceFcfa'] ?? $item['finalLinePriceFcfa'] ?? 0);

            return [
                'slug' => $slug !== '' ? $slug : null,
                'title' => $item['title'] ?? $item['productName'] ?? ($quoted['title'] ?? 'Produit'),
                'productName' => $item['productName'] ?? $item['title'] ?? ($quoted['title'] ?? 'Produit'),
                'image' => $item['image'] ?? ($quoted['image'] ?? '/globe.svg'),
                'quantity' => (int) ($quoted['quantity'] ?? $item['quantity'] ?? 1),
                'selectedVariants' => $selectedVariants,
                'finalLinePriceFcfa' => $finalLinePrice,
            ];
        })->values()->all();

        $itemsSubtotal = collect($items)->sum(fn (array $item) => (float) ($item['finalLinePriceFcfa'] ?? 0));
        $shippingPrice = (float) ($shippingOption['priceFcfa'] ?? $validated['shippingPriceFcfa'] ?? 0);
        $totalPrice = $itemsSubtotal + $shippingPrice;
        $paymentMethod = (string) ($validated['paymentMethod'] ?? 'card');
        if ($totalPrice <= 0) {
            throw ValidationException::withMessages([
                'items' => ['Le montant total de la commande est nul. Recalculez le panier avant de payer.'],
            ]);
        }

        if ($paymentMethod === 'pay_on_delivery' && $totalPrice > self::PAY_ON_DELIVERY_LIMIT_FCFA) {
            throw ValidationException::withMessages([
                'paymentMethod' => ['Le paiement apres livraison est limite a 30 000 FCFA pour cette devise.'],
            ]);
        }

        $promoCode = isset($validated['promoCode']) ? strtoupper((string) $validated['promoCode']) : null;
        $productIdsBySlug = Product::query()
            ->whereIn('slug', collect($items)->pluck('slug')->filter()->unique()->values()->all())
            ->pluck('id', 'slug');

        $order = DB::transaction(function () use ($validated, $user, $items, $itemsSubtotal, $shippingMethod, $shippingOption, $shippingPrice, $totalPrice, $paymentMethod, $promoCode, $productIdsBySlug) {
            $order = Order::query()->create([
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
                'base_price' => $itemsSubtotal,
                'total_price' => $totalPrice,
                'status' => 'checkout_created',
                'payment_status' => 'unpaid',
                'payment_currency' => 'XOF',
                'payment_provider' => $paymentMethod === 'pay_on_delivery' ? null : 'moneroo',
                'shipping_method' => $shippingMethod,
                'meta' => [
                    'promo' => $promoCode ? [
                        'code' => $promoCode,
                        'discountFcfa' => 0,
                        'baseTotalFcfa' => $totalPrice,
                        'finalTotalFcfa' => $totalPrice,
                    ] : null,
                    'pricing' => [
                        'itemsSubtotalFcfa' => $itemsSubtotal,
                        'shippingPriceFcfa' => $shippingPrice,
                        'shippingLabel' => $shippingOption['label'] ?? $shippingMethod,
                        'shippingDeliveryWindow' => $shippingOption['deliveryWindow'] ?? null,
                        'totalPriceFcfa' => $totalPrice,
                    ],
                    'paymentMethod' => $paymentMethod,
                    'notes' => $validated['notes'] ?? null,
                ],
            ]);

            $order->orderItems()->createMany(collect($items)->map(function (array $item) use ($productIdsBySlug) {
                $quantity = (int) ($item['quantity'] ?? 1);
                $lineTotal = (float) ($item['finalLinePriceFcfa'] ?? 0);

                return [
                    'product_id' => $item['slug'] ? $productIdsBySlug->get($item['slug']) : null,
                    'slug_snapshot' => $item['slug'] ?? null,
                    'title_snapshot' => $item['title'] ?? $item['productName'] ?? 'Produit',
                    'image_snapshot' => $item['image'] ?? '/globe.svg',
                    'quantity' => $quantity,
                    'unit_price' => $quantity > 0 ? round($lineTotal / $quantity, 2) : 0,
                    'line_total' => round($lineTotal, 2),
                ];
            })->all());

            return $order->fresh(['payments', 'orderItems']);
        });

        $this->emails->sendOrderCreated($order->loadMissing('user'));

        return $order;
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
