<?php

namespace App\Services;

use App\Models\ApiPartner;
use App\Models\Order;
use App\Models\OrderTracking;
use App\Models\PartnerOrder;
use App\Models\PartnerTransaction;
use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PartnerOrderService
{
    public function __construct(
        protected PaymentService $payments,
    ) {
    }

    public function paginateProducts(Request $request): array
    {
        $perPage = min(max($request->integer('per_page', 25), 1), 100);
        $paginator = Product::query()
            ->where('is_published', true)
            ->latest()
            ->paginate($perPage);

        return [
            'items' => $paginator->getCollection()->map(fn (Product $product) => $this->transformProduct($product))->values()->all(),
            'pagination' => $this->transformPagination($paginator),
        ];
    }

    public function createOrder(ApiPartner $partner, array $validated): array
    {
        $product = Product::query()
            ->whereKey($validated['product_id'])
            ->where('is_published', true)
            ->firstOrFail();

        $basePrice = (float) $product->price;
        $sellingPrice = (float) $validated['selling_price'];
        $quantity = max((int) ($validated['quantity'] ?? 1), 1);
        $totalBasePrice = $basePrice * $quantity;
        $totalSellingPrice = $sellingPrice * $quantity;
        $margin = ($sellingPrice - $basePrice) * $quantity;

        if ($sellingPrice < $basePrice) {
            throw ValidationException::withMessages([
                'selling_price' => 'Le selling_price ne peut pas etre inferieur au prix produit.',
            ]);
        }

        [$order, $partnerOrder] = DB::transaction(function () use ($partner, $product, $validated, $sellingPrice, $basePrice, $quantity, $totalSellingPrice, $totalBasePrice, $margin) {
            $customer = $validated['customer'];
            $order = Order::query()->create([
                'order_number' => 'AFR-PARTNER-'.Str::upper(Str::random(10)),
                'product_id' => $product->id,
                'customer_name' => $customer['name'],
                'customer_email' => $customer['email'] ?? $this->fallbackCustomerEmail($partner),
                'customer_phone' => $customer['phone'],
                'user_info' => [
                    'source' => 'partner_api',
                    'partnerId' => $partner->id,
                    'partnerAppKey' => $partner->app_key,
                ],
                'country_code' => strtoupper((string) ($validated['customer']['country_code'] ?? 'CI')),
                'items' => [[
                    'productId' => $product->id,
                    'slug' => $product->slug,
                    'title' => $product->title,
                    'productName' => $product->title,
                    'image' => $product->primary_image_url,
                    'quantity' => $quantity,
                    'finalLinePriceFcfa' => $totalSellingPrice,
                ]],
                'base_price' => $totalBasePrice,
                'quantity' => $quantity,
                'total_price' => $totalSellingPrice,
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'payment_currency' => 'XOF',
                'payment_provider' => 'moneroo',
                'shipping_method' => $validated['shipping_method'] ?? 'air',
                'meta' => [
                    'partner' => [
                        'partnerId' => $partner->id,
                        'companyName' => $partner->company_name,
                        'basePrice' => $basePrice,
                        'sellingPrice' => $sellingPrice,
                        'totalBasePrice' => $totalBasePrice,
                        'totalSellingPrice' => $totalSellingPrice,
                        'margin' => $margin,
                    ],
                ],
            ]);

            $partnerOrder = PartnerOrder::query()->create([
                'partner_id' => $partner->id,
                'order_id' => $order->id,
                'margin' => $margin,
                'selling_price' => $sellingPrice,
                'quantity' => $quantity,
                'status' => 'pending',
            ]);

            OrderTracking::query()->create([
                'order_id' => $order->id,
                'status' => 'pending',
                'description' => 'Commande partenaire creee et en attente de paiement.',
            ]);

            return [$order, $partnerOrder];
        });

        $payment = $this->payments->initialize($order, 'moneroo');

        return [
            'order_id' => $order->order_number,
            'order' => $this->transformPartnerOrder($partnerOrder->fresh(['order.payments', 'order.trackingEvents'])),
            'payment_url' => $payment['checkoutUrl'] ?? null,
            'payment_id' => $payment['paymentId'] ?? null,
        ];
    }

    public function listOrders(ApiPartner $partner, Request $request): array
    {
        $allowedStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
        $status = (string) $request->query('status', '');
        $perPage = min(max($request->integer('per_page', 25), 1), 100);
        $paginator = PartnerOrder::query()
            ->with(['order.payments', 'order.trackingEvents'])
            ->where('partner_id', $partner->id)
            ->when(in_array($status, $allowedStatuses, true), fn ($query) => $query->where('status', $status))
            ->latest()
            ->paginate($perPage);

        return [
            'items' => $paginator->getCollection()->map(fn (PartnerOrder $partnerOrder) => $this->transformPartnerOrder($partnerOrder))->values()->all(),
            'pagination' => $this->transformPagination($paginator),
        ];
    }

    public function wallet(ApiPartner $partner): array
    {
        $partner->loadMissing(['wallet', 'transactions' => fn ($query) => $query->latest()->limit(20)]);

        return [
            'partner_id' => (string) $partner->id,
            'balance' => (float) ($partner->wallet?->balance ?? 0),
            'transactions' => $partner->transactions->map(fn (PartnerTransaction $transaction) => [
                'id' => (string) $transaction->id,
                'amount' => (float) $transaction->amount,
                'type' => $transaction->type,
                'description' => $transaction->description,
                'created_at' => optional($transaction->created_at)->toIso8601String(),
            ])->values()->all(),
        ];
    }

    public function transformProduct(Product $product): array
    {
        return [
            'id' => (string) $product->id,
            'name' => $product->title,
            'base_price' => (float) $product->price,
            'price' => (float) $product->price,
            'stock' => (int) $product->stock,
            'description' => $product->description,
            'image' => $product->primary_image_url,
            'updated_at' => optional($product->updated_at)->toIso8601String(),
        ];
    }

    public function showOrder(ApiPartner $partner, string $identifier): array
    {
        $partnerOrder = PartnerOrder::query()
            ->with(['order.payments', 'order.trackingEvents', 'order.orderItems.product'])
            ->where('partner_id', $partner->id)
            ->where(function ($query) use ($identifier) {
                $query->whereKey($identifier)
                    ->orWhereHas('order', fn ($orderQuery) => $orderQuery->where('order_number', $identifier));
            })
            ->firstOrFail();

        return [
            'order' => $this->transformPartnerOrderDetail($partnerOrder),
        ];
    }

    public function recordTrackingUpdate(Order $order, string $status, string $description, ?string $trackingReference = null): void
    {
        $allowedStatuses = ['processing', 'shipped', 'delivered', 'cancelled', 'paid', 'pending'];
        if (! in_array($status, $allowedStatuses, true)) {
            throw ValidationException::withMessages([
                'status' => 'Statut de suivi invalide.',
            ]);
        }

        DB::transaction(function () use ($order, $status, $description, $trackingReference) {
            $order->forceFill([
                'status' => $status,
                'tracking_reference' => $trackingReference ?: $order->tracking_reference,
            ])->save();

            $order->partnerOrder?->forceFill(['status' => $status])->save();

            OrderTracking::query()->create([
                'order_id' => $order->id,
                'status' => $status,
                'description' => $description,
            ]);
        });
    }

    public function transformPartnerOrder(PartnerOrder $partnerOrder): array
    {
        $order = $partnerOrder->relationLoaded('order') ? $partnerOrder->order : $partnerOrder->order()->with(['payments', 'trackingEvents'])->first();
        $payment = $order?->payments?->sortByDesc('id')->first() ?? $order?->payments()->latest()->first();
        $productItem = collect($order?->items ?? [])->first();

        return [
            'id' => (string) $partnerOrder->id,
            'order_id' => (string) ($order?->order_number ?? $partnerOrder->order_id),
            'internal_order_id' => (string) $partnerOrder->order_id,
            'partner_id' => (string) $partnerOrder->partner_id,
            'product' => (string) ($productItem['title'] ?? $productItem['productName'] ?? 'Produit'),
            'margin' => (float) $partnerOrder->margin,
            'selling_price' => (float) $partnerOrder->selling_price,
            'quantity' => (int) $partnerOrder->quantity,
            'status' => $partnerOrder->status,
            'payment_status' => $order?->payment_status,
            'payment_url' => $order?->payment_checkout_url ?? $payment?->checkout_url,
            'created_at' => optional($partnerOrder->created_at)->toIso8601String(),
        ];
    }

    public function transformPartnerOrderDetail(PartnerOrder $partnerOrder): array
    {
        $order = $partnerOrder->order;
        $productItem = collect($order?->items ?? [])->first();

        return [
            'order_id' => (string) ($order?->order_number ?? $partnerOrder->order_id),
            'product' => (string) ($productItem['title'] ?? $productItem['productName'] ?? 'Produit'),
            'status' => $partnerOrder->status,
            'margin' => (float) $partnerOrder->margin,
            'selling_price' => (float) $partnerOrder->selling_price,
            'quantity' => (int) $partnerOrder->quantity,
            'customer' => [
                'name' => $order?->customer_name,
                'phone' => $order?->customer_phone,
                'email' => $order?->customer_email,
            ],
            'tracking' => [
                'reference' => $order?->tracking_reference,
                'events' => $order?->trackingEvents?->map(fn (OrderTracking $event) => [
                    'status' => $event->status,
                    'description' => $event->description,
                    'created_at' => optional($event->created_at)->toIso8601String(),
                ])->values()->all() ?? [],
            ],
            'payment_url' => $order?->payment_checkout_url,
            'created_at' => optional($partnerOrder->created_at)->toIso8601String(),
        ];
    }

    protected function transformPagination(LengthAwarePaginator $paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ];
    }

    protected function fallbackCustomerEmail(ApiPartner $partner): string
    {
        return 'partner-'.$partner->id.'-'.Str::lower(Str::random(12)).'@partners.afripay.local';
    }
}