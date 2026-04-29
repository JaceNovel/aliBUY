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
use RuntimeException;

class OrderService
{
    protected const PAY_ON_DELIVERY_LIMIT_FCFA = 30000;

    public function __construct(
        protected SourcingQuoteService $quotes,
        protected EmailAutomationService $emails,
        protected ManyChatService $manychat,
        protected AlibabaAdminService $alibabaAdmin,
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
        $meta = is_array($order->meta) ? $order->meta : [];
        $meta['manychat'] = $this->resolveEffectiveManyChatMeta($order, $meta);
        $pricing = is_array($meta['pricing'] ?? null) ? $meta['pricing'] : [];
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
            'shippingCostFcfa' => (int) round((float) ($pricing['shippingPriceFcfa'] ?? 0)),
            'cartProductsTotalFcfa' => (int) round((float) ($pricing['itemsSubtotalFcfa'] ?? $order->base_price ?? 0)),
            'totalWeightKg' => (float) ($pricing['totalWeightKg'] ?? 0),
            'totalVolumeCbm' => (float) ($pricing['totalVolumeCbm'] ?? 0),
            'freightStatus' => (string) ($meta['freightStatus'] ?? 'not_requested'),
            'supplierOrderStatus' => (string) ($meta['supplierOrderStatus'] ?? 'not_created'),
            'alibabaTradeIds' => collect($meta['alibabaTradeIds'] ?? [])->filter(fn ($entry) => is_string($entry) && trim($entry) !== '')->values()->all(),
            'totalPriceFcfa' => (int) round((float) $order->total_price),
            'paymentStatus' => (string) $order->payment_status,
            'paymentCurrency' => (string) ($order->payment_currency ?? 'XOF'),
            'paymentProvider' => (string) ($order->payment_provider ?? 'moneroo'),
            'paymentReference' => $order->payment_reference ?? $payment?->transaction_id,
            'paymentCheckoutUrl' => $order->payment_checkout_url ?? $payment?->checkout_url,
            'paymentProviderStatus' => $payment?->status ?? $order->payment_status,
            'monerooPaymentId' => $order->payment_reference ?? $payment?->transaction_id,
            'monerooCheckoutUrl' => $order->payment_checkout_url ?? $payment?->checkout_url,
            'monerooPaymentStatus' => $payment?->status ?? $order->payment_status,
            'createdAt' => optional($order->created_at)->toIso8601String(),
            'updatedAt' => optional($order->updated_at)->toIso8601String(),
            'items' => $items,
            'meta' => $meta,
        ];
    }

    public function updateAdminSourcingOrder(Order $order, array $payload): array
    {
        $action = trim((string) ($payload['action'] ?? ''));
        if ($action === '') {
            throw ValidationException::withMessages([
                'action' => ['Action admin sourcing manquante.'],
            ]);
        }

        return match ($action) {
            'update-status' => $this->updateAdminStatus($order, $payload),
            'mark-client-paid' => $this->markAdminClientPayment($order, 'paid'),
            'mark-client-failed' => $this->markAdminClientPayment($order, 'failed'),
            'set-relay-point' => $this->setAdminRelayPoint($order, $payload),
            'update-manual-fulfillment' => $this->updateAdminManualFulfillment($order, $payload),
            'update-manychat-link' => $this->updateAdminManyChatLink($order, $payload),
            'send-whatsapp-update-now' => $this->sendAdminManyChatUpdate($order),
            'update-parcel-manual' => $this->updateAdminParcel($order, $payload),
            'remove-parcel-photo' => $this->removeAdminParcelPhoto($order, $payload),
            'add-proof' => $this->addAdminProof($order, $payload),
            'launch-supplier-payment' => $this->launchAdminSupplierPayment($order, 'admin-order-manual'),
            'repair-supplier-order' => $this->launchAdminSupplierPayment($order, 'admin-repair'),
            'override-delivery-route' => $this->overrideAdminDeliveryRoute($order, $payload),
            default => throw ValidationException::withMessages([
                'action' => ['Action admin sourcing non prise en charge.'],
            ]),
        };
    }

    public function registerAdminDeliveryNoteExport(Order $order, string $disposition, ?string $exportedByEmail = null): array
    {
        $meta = $this->getOrderMeta($order);
        $exports = collect($meta['deliveryNoteExports'] ?? [])->filter(fn ($entry) => is_array($entry))->values()->all();
        array_unshift($exports, [
            'id' => (string) Str::uuid(),
            'documentNumber' => $this->buildDeliveryNoteDocumentNumber($order),
            'disposition' => $disposition === 'attachment' ? 'attachment' : 'inline',
            'exportedAt' => now()->toIso8601String(),
            'exportedByEmail' => $this->normalizeOptionalString($exportedByEmail),
        ]);

        $meta['deliveryNoteExports'] = array_slice($exports, 0, 25);
        $order->forceFill(['meta' => $meta])->save();

        return [
            'order' => $this->transformOrder($order->fresh('payments')),
            'documentNumber' => $this->buildDeliveryNoteDocumentNumber($order),
        ];
    }

    protected function updateAdminStatus(Order $order, array $payload): array
    {
        $allowed = ['air_batch_pending', 'sea_batch_pending', 'supplier_payment_requested', 'supplier_payment_failed', 'supplier_paid_partial', 'supplier_paid', 'shipment_triggered', 'in_transit_to_agent', 'delivered_to_agent', 'relay_ready', 'completed'];
        $status = trim((string) ($payload['status'] ?? ''));
        if (! in_array($status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ['Statut sourcing invalide.'],
            ]);
        }

        $meta = $this->getOrderMeta($order);
        $workflow = $this->getWorkflow($meta);
        $timestamp = now()->toIso8601String();

        if ($status === 'delivered_to_agent' && ($workflow['deliveredToAgentAt'] ?? '') === '') {
            $workflow['deliveredToAgentAt'] = $timestamp;
        }
        if ($status === 'relay_ready' && ($workflow['availableForPickupAt'] ?? '') === '') {
            $workflow['availableForPickupAt'] = $timestamp;
        }
        if ($status === 'completed' && ($workflow['completedAt'] ?? '') === '') {
            $workflow['completedAt'] = $timestamp;
        }

        $meta['workflow'] = $workflow;
        $order->forceFill([
            'status' => $status,
            'meta' => $meta,
        ])->save();

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function markAdminClientPayment(Order $order, string $paymentStatus): array
    {
        if (! in_array($paymentStatus, ['paid', 'failed'], true)) {
            throw ValidationException::withMessages([
                'paymentStatus' => ['Statut de paiement admin invalide.'],
            ]);
        }

        $order->forceFill([
            'payment_status' => $paymentStatus,
        ])->save();

        $latestPayment = $order->payments()->latest('id')->first();
        if ($latestPayment) {
            $latestPayment->forceFill([
                'status' => $paymentStatus,
                'verified_at' => $paymentStatus === 'paid' ? now() : null,
            ])->save();
        }

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function setAdminRelayPoint(Order $order, array $payload): array
    {
        $meta = $this->getOrderMeta($order);
        $workflow = $this->getWorkflow($meta);
        $workflow['relayPointAddress'] = $this->normalizeOptionalString($payload['relayPointAddress'] ?? null);
        $workflow['relayPointLabel'] = $this->normalizeOptionalString($payload['relayPointLabel'] ?? null);
        $meta['workflow'] = $workflow;
        $order->forceFill(['meta' => $meta])->save();

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function updateAdminManualFulfillment(Order $order, array $payload): array
    {
        $meta = $this->getOrderMeta($order);
        $meta['manualFulfillment'] = [
            'enabled' => ($payload['enabled'] ?? false) === true,
            'statusLabel' => $this->normalizeOptionalString($payload['statusLabel'] ?? null),
            'checkpointLabel' => $this->normalizeOptionalString($payload['checkpointLabel'] ?? null),
            'checkpointNote' => $this->normalizeOptionalString($payload['checkpointNote'] ?? null),
            'agentName' => $this->normalizeOptionalString($payload['agentName'] ?? null),
            'agentPhone' => $this->normalizeOptionalString($payload['agentPhone'] ?? null),
            'etaLabel' => $this->normalizeOptionalString($payload['etaLabel'] ?? null),
            'lastUpdatedAt' => now()->toIso8601String(),
        ];
        $order->forceFill(['meta' => $meta])->save();

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function updateAdminManyChatLink(Order $order, array $payload): array
    {
        $meta = $this->getOrderMeta($order);
        $current = is_array($meta['manychat'] ?? null) ? $meta['manychat'] : [];
        $subscriberId = $this->normalizeOptionalString($payload['subscriberId'] ?? null);
        $flowId = $this->normalizeOptionalString($payload['flowId'] ?? null);
        $paidTagId = $this->normalizeOptionalString($payload['paidTagId'] ?? null);

        if ($subscriberId === '' && ($flowId !== '' || $paidTagId !== '')) {
            throw ValidationException::withMessages([
                'subscriberId' => ['Le subscriber ManyChat est obligatoire pour enregistrer cette liaison.'],
            ]);
        }

        if ($subscriberId !== '') {
            $meta['manychat'] = array_filter([
                ...$current,
                'subscriberId' => $subscriberId,
                'flowId' => $flowId,
                'paidTagId' => $paidTagId,
            ], fn ($value) => $value !== null && $value !== '');
            $order->forceFill(['meta' => $meta])->save();
        } elseif (isset($meta['manychat'])) {
            unset($meta['manychat']);
            $order->forceFill(['meta' => $meta])->save();
        }

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function resolveEffectiveManyChatMeta(Order $order, array $meta): array
    {
        $manychat = is_array($meta['manychat'] ?? null) ? $meta['manychat'] : [];
        $settings = is_array($order->user?->settings) ? $order->user->settings : [];

        return array_filter([
            ...$manychat,
            'subscriberId' => $this->normalizeOptionalString($manychat['subscriberId'] ?? $settings['manychatSubscriberId'] ?? null),
            'flowId' => $this->normalizeOptionalString($manychat['flowId'] ?? $settings['manychatFlowId'] ?? null),
            'paidTagId' => $this->normalizeOptionalString($manychat['paidTagId'] ?? $settings['manychatPaidTagId'] ?? null),
            'connectedWhatsapp' => $this->normalizeOptionalString($manychat['connectedWhatsapp'] ?? $settings['connectedWhatsapp'] ?? null),
        ], fn ($value) => $value !== null && $value !== '');
    }

    protected function sendAdminManyChatUpdate(Order $order): array
    {
        $meta = $this->getOrderMeta($order);
        $manychat = is_array($meta['manychat'] ?? null) ? $meta['manychat'] : [];
        if ($this->normalizeOptionalString($manychat['subscriberId'] ?? null) === '') {
            throw ValidationException::withMessages([
                'subscriberId' => ['Aucun subscriber ManyChat n\'est lie a cette commande.'],
            ]);
        }

        $manual = is_array($meta['manualFulfillment'] ?? null) ? $meta['manualFulfillment'] : [];
        $detailParts = array_values(array_filter([
            $this->normalizeOptionalString($manual['checkpointLabel'] ?? null),
            $this->normalizeOptionalString($manual['checkpointNote'] ?? null),
        ]));
        $title = $this->normalizeOptionalString($manual['statusLabel'] ?? null) ?: $this->humanizeSourcingStatus((string) $order->status);
        $sent = $this->manychat->sendLogisticsUpdate($order->loadMissing('user'), $title, $detailParts !== [] ? implode('. ', $detailParts) : null);
        if (! $sent) {
            throw new RuntimeException('Impossible d\'envoyer la mise a jour ManyChat pour cette commande.');
        }

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function updateAdminParcel(Order $order, array $payload): array
    {
        $meta = $this->getOrderMeta($order);
        $parcel = is_array($meta['parcel'] ?? null) ? $meta['parcel'] : ['photos' => []];
        $photos = collect($parcel['photos'] ?? [])->filter(fn ($entry) => is_array($entry))->values()->all();
        $photoUrl = $this->normalizeOptionalString($payload['photoUrl'] ?? null);

        if ($photoUrl !== '') {
            $photos[] = array_filter([
                'id' => (string) Str::uuid(),
                'url' => $photoUrl,
                'label' => $this->normalizeOptionalString($payload['photoLabel'] ?? null),
                'createdAt' => now()->toIso8601String(),
            ], fn ($value) => $value !== null && $value !== '');
        }

        $meta['parcel'] = [
            'note' => $this->normalizeOptionalString($payload['note'] ?? null),
            'photos' => $photos,
            'updatedAt' => now()->toIso8601String(),
        ];
        $order->forceFill(['meta' => $meta])->save();

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function removeAdminParcelPhoto(Order $order, array $payload): array
    {
        $photoId = trim((string) ($payload['photoId'] ?? ''));
        $meta = $this->getOrderMeta($order);
        $parcel = is_array($meta['parcel'] ?? null) ? $meta['parcel'] : ['photos' => []];
        $parcel['photos'] = collect($parcel['photos'] ?? [])
            ->filter(fn ($entry) => is_array($entry) && (string) ($entry['id'] ?? '') !== $photoId)
            ->values()
            ->all();
        $parcel['updatedAt'] = now()->toIso8601String();
        $meta['parcel'] = $parcel;
        $order->forceFill(['meta' => $meta])->save();

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function addAdminProof(Order $order, array $payload): array
    {
        $title = trim((string) ($payload['title'] ?? ''));
        if ($title === '') {
            throw ValidationException::withMessages([
                'title' => ['Le titre de la preuve est obligatoire.'],
            ]);
        }

        $meta = $this->getOrderMeta($order);
        $workflow = $this->getWorkflow($meta);
        $proofs = collect($workflow['proofs'] ?? [])->filter(fn ($entry) => is_array($entry))->values()->all();
        $proofs[] = array_filter([
            'id' => (string) Str::uuid(),
            'role' => trim((string) ($payload['role'] ?? 'supplier_to_agent')),
            'title' => $title,
            'note' => $this->normalizeOptionalString($payload['note'] ?? null),
            'mediaUrl' => $this->normalizeOptionalString($payload['mediaUrl'] ?? null),
            'actorLabel' => $this->normalizeOptionalString($payload['actorLabel'] ?? null),
            'createdAt' => now()->toIso8601String(),
        ], fn ($value) => $value !== null && $value !== '');
        $workflow['proofs'] = $proofs;
        $meta['workflow'] = $workflow;
        $order->forceFill(['meta' => $meta])->save();

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function launchAdminSupplierPayment(Order $order, string $trigger): array
    {
        if ((string) $order->payment_status !== 'paid') {
            throw ValidationException::withMessages([
                'paymentStatus' => ['Cette commande client n\'est pas encore marquee comme payee.'],
            ]);
        }

        $order->loadMissing('orderItems.product', 'payments');
        $launchResult = $this->alibabaAdmin->createLiveDropshippingOrdersForClientOrder($order);
        $meta = $this->getOrderMeta($order);
        $tradeIds = collect($launchResult['alibabaTradeIds'] ?? [])->filter(fn ($entry) => is_string($entry) && trim($entry) !== '')->values()->all();
        $supplierOrders = collect($launchResult['supplierOrderPayload']['orders'] ?? [])->filter(fn ($entry) => is_array($entry))->values();
        $paidCount = $supplierOrders->filter(fn ($entry) => ($entry['paymentStatus'] ?? null) === 'paid')->count();
        $pendingCount = $supplierOrders->filter(fn ($entry) => in_array(($entry['paymentStatus'] ?? null), ['pending', 'pay_url_generated'], true))->count();
        $failedCount = $supplierOrders->filter(fn ($entry) => ($entry['paymentStatus'] ?? null) === 'failed' || ($entry['requestOk'] ?? true) === false)->count();

        $automation = is_array($meta['automation'] ?? null) ? $meta['automation'] : [];
        $automation['alibabaPostPayment'] = [
            'lastProcessedAt' => now()->toIso8601String(),
            'lastTrigger' => $trigger,
            'trades' => $supplierOrders->map(function (array $entry) {
                return array_filter([
                    'tradeId' => $entry['tradeId'] ?? null,
                    'orderItemId' => $entry['orderItemId'] ?? null,
                    'productSlug' => $entry['productSlug'] ?? null,
                    'paymentRequestedAt' => now()->toIso8601String(),
                    'paymentRequestStatus' => ($entry['requestOk'] ?? false) ? 'requested' : 'failed',
                    'paymentRequestMessage' => $entry['message'] ?? 'Lancement DS execute cote Laravel.',
                    'paymentResultStatus' => $entry['paymentStatus'] ?? 'pending',
                    'payUrl' => $entry['payUrl'] ?? null,
                    'tracking' => [],
                ], fn ($value) => $value !== null && $value !== '');
            })->all(),
            'summary' => [
                'paidCount' => $paidCount,
                'pendingCount' => $pendingCount,
                'failedCount' => $failedCount,
            ],
        ];

        $meta['automation'] = $automation;
        $meta['alibabaTradeIds'] = $tradeIds;
        $meta['supplierOrderStatus'] = (string) ($launchResult['supplierOrderStatus'] ?? 'failed');
        $meta['freightStatus'] = (string) ($launchResult['freightStatus'] ?? 'failed');
        $meta['supplierOrderPayload'] = $launchResult['supplierOrderPayload'] ?? null;
        $order->forceFill([
            'status' => (string) ($launchResult['status'] ?? 'supplier_payment_requested'),
            'meta' => $meta,
        ])->save();

        return ['order' => $this->transformOrder($order->fresh('payments'))];
    }

    protected function overrideAdminDeliveryRoute(Order $order, array $payload): array
    {
        $mode = ($payload['mode'] ?? null) === 'forwarder' ? 'forwarder' : 'direct';
        $hub = ($payload['hub'] ?? null) === 'lome' ? 'lome' : 'china';
        $meta = $this->getOrderMeta($order);
        $deliveryProfile = is_array($meta['deliveryProfile'] ?? null) ? $meta['deliveryProfile'] : [];
        $workflow = $this->getWorkflow($meta);

        if ($mode === 'forwarder') {
            $deliveryProfile = [
                ...$deliveryProfile,
                'mode' => 'forwarder',
                'usesInternalReceptionAddress' => false,
                'unsupportedCountry' => false,
                'unsupportedMessage' => null,
                'forwarder' => [
                    'hub' => $hub,
                    'addressBlock' => trim((string) (($deliveryProfile['forwarder']['addressBlock'] ?? null) ?: implode("\n", array_filter([
                        $order->address_line1,
                        $order->address_line2,
                        trim((string) $order->city.' '.(string) $order->postal_code),
                        $order->country_code,
                    ])))),
                    'parcelMarking' => trim((string) (($deliveryProfile['forwarder']['parcelMarking'] ?? null) ?: ('Client '.$order->customer_name.' '.$order->customer_phone))),
                ],
            ];
            $workflow['routeType'] = 'customer-forwarder';
            $workflow['freeDeliveryEligible'] = false;
            $workflow['supplierDeliveryAddressRole'] = 'forwarder';
        } else {
            $deliveryProfile = [
                ...$deliveryProfile,
                'mode' => 'direct',
                'usesInternalReceptionAddress' => true,
                'unsupportedCountry' => false,
                'unsupportedMessage' => null,
                'forwarder' => null,
            ];
            $workflow['routeType'] = 'afripay-final-mile';
            $workflow['freeDeliveryEligible'] = false;
            $workflow['supplierDeliveryAddressRole'] = 'afripay-agent';
        }

        $meta['deliveryProfile'] = $deliveryProfile;
        $meta['workflow'] = $workflow;
        $order->forceFill(['meta' => $meta])->save();

        $response = ['order' => $this->transformOrder($order->fresh('payments'))];
        if (($payload['relaunch'] ?? false) === true) {
            $response['relaunchMessage'] = 'Route d\'achat mise a jour cote API Laravel.';
        }

        return $response;
    }

    protected function getOrderMeta(Order $order): array
    {
        return is_array($order->meta) ? $order->meta : [];
    }

    protected function getWorkflow(array $meta): array
    {
        $workflow = is_array($meta['workflow'] ?? null) ? $meta['workflow'] : [];

        return [
            'routeType' => ($workflow['routeType'] ?? null) === 'customer-forwarder' ? 'customer-forwarder' : 'afripay-final-mile',
            'freeDeliveryEligible' => ($workflow['freeDeliveryEligible'] ?? true) !== false,
            'supplierDeliveryAddressRole' => ($workflow['supplierDeliveryAddressRole'] ?? null) === 'forwarder' ? 'forwarder' : 'afripay-agent',
            'relayPointAddress' => $this->normalizeOptionalString($workflow['relayPointAddress'] ?? null),
            'relayPointLabel' => $this->normalizeOptionalString($workflow['relayPointLabel'] ?? null),
            'availableForPickupAt' => $this->normalizeOptionalString($workflow['availableForPickupAt'] ?? null),
            'deliveredToAgentAt' => $this->normalizeOptionalString($workflow['deliveredToAgentAt'] ?? null),
            'completedAt' => $this->normalizeOptionalString($workflow['completedAt'] ?? null),
            'proofs' => collect($workflow['proofs'] ?? [])->filter(fn ($entry) => is_array($entry))->values()->all(),
        ];
    }

    protected function humanizeSourcingStatus(string $status): string
    {
        return match ($status) {
            'air_batch_pending' => 'En attente lot avion',
            'sea_batch_pending' => 'En attente lot maritime',
            'supplier_payment_requested' => 'Paiement fournisseur en cours',
            'supplier_payment_failed' => 'Paiement fournisseur a reprendre',
            'supplier_paid_partial' => 'Paiement fournisseur partiel',
            'supplier_paid' => 'Commande fournisseur reglee',
            'shipment_triggered' => 'Expedition declenchee',
            'in_transit_to_agent' => 'En transit vers agent',
            'delivered_to_agent' => 'Livre a l\'agent',
            'relay_ready' => 'Disponible au point relais',
            'completed' => 'Commande remise au client',
            default => 'Commande en traitement',
        };
    }

    protected function buildDeliveryNoteDocumentNumber(Order $order): string
    {
        $seed = sha1((string) $order->getKey().':'.(string) $order->order_number.':'.optional($order->created_at)->toIso8601String());

        return 'BSD-'.optional($order->created_at)->format('Y').'-'.strtoupper(substr($seed, 0, 8));
    }

    protected function normalizeOptionalString(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }
}
