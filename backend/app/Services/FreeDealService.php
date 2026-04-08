<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Throwable;

class FreeDealService
{
    public function __construct(
        protected OrderService $orders,
        protected PaymentService $payments,
    ) {
    }

    public function state(Request $request): array
    {
        $config = $this->config();
        $products = $this->products($config['productSlugs'] ?? []);

        return [
            'config' => $config,
            'products' => $products,
            'claimedProductSlugs' => [],
            'access' => [
                'status' => ($config['enabled'] ?? false) ? 'eligible' : 'disabled',
                'referralVisitCount' => 0,
                'referralGoal' => (int) ($config['referralGoal'] ?? 20),
                'sharePath' => null,
                'referralCode' => null,
            ],
        ];
    }

    public function checkout(array $validated): array
    {
        $config = $this->config();
        $selectedSlugs = array_values(array_unique(array_map('strval', $validated['selectedSlugs'] ?? [])));
        $itemLimit = (int) ($config['itemLimit'] ?? 0);
        if (! ($config['enabled'] ?? false) || $itemLimit <= 0) {
            abort(422, 'Cette offre est actuellement indisponible.');
        }

        if (count($selectedSlugs) !== $itemLimit) {
            abort(422, 'Vous devez choisir exactement '.$itemLimit.' article(s).');
        }

        $products = collect($this->products($selectedSlugs))->keyBy('slug');
        $fixedPriceFcfa = $this->fixedPriceFcfa((float) ($config['fixedPriceEur'] ?? 10));
        $baseAllocation = intdiv($fixedPriceFcfa, max($itemLimit, 1));
        $remainder = $fixedPriceFcfa - ($baseAllocation * $itemLimit);

        $items = collect($selectedSlugs)->values()->map(function (string $slug, int $index) use ($products, $baseAllocation, $remainder) {
            $product = $products->get($slug);
            $lineTotal = $baseAllocation + ($index === 0 ? $remainder : 0);

            return [
                'slug' => $slug,
                'title' => $product['shortTitle'] ?? $product['title'] ?? $slug,
                'productName' => $product['shortTitle'] ?? $product['title'] ?? $slug,
                'image' => $product['image'] ?? '/globe.svg',
                'quantity' => 1,
                'finalLinePriceFcfa' => $lineTotal,
            ];
        })->all();

        $order = $this->orders->store([
            'customerName' => $validated['customerName'],
            'customerEmail' => $validated['customerEmail'],
            'customerPhone' => $validated['customerPhone'],
            'addressLine1' => $validated['addressLine1'],
            'addressLine2' => $validated['addressLine2'] ?? null,
            'city' => $validated['city'],
            'state' => $validated['state'] ?? $validated['city'],
            'postalCode' => $validated['postalCode'] ?? null,
            'countryCode' => strtoupper($validated['countryCode']),
            'shippingMethod' => 'sea',
            'paymentMethod' => 'card',
            'items' => $items,
            'notes' => 'free-deal-checkout',
        ], null);

        $meta = $order->meta ?? [];
        $meta['freeDeal'] = [
            'selectedProductSlugs' => $selectedSlugs,
            'fixedPriceEur' => (float) ($config['fixedPriceEur'] ?? 10),
            'fixedPriceFcfa' => $fixedPriceFcfa,
            'itemLimit' => $itemLimit,
            'referralGoal' => (int) ($config['referralGoal'] ?? 20),
        ];
        $order->forceFill(['meta' => $meta])->save();

        $paymentPayload = $this->payments->initialize($order);

        return [
            'orderId' => (string) $order->id,
            'checkoutUrl' => $paymentPayload['checkoutUrl'] ?? null,
            'paymentId' => $paymentPayload['paymentId'] ?? null,
        ];
    }

    protected function config(): array
    {
        $path = base_path('data/site/free-deal-config.json');
        $default = [
            'enabled' => false,
            'pageTitle' => 'Articles gratuits',
            'heroBadge' => 'OFFRE TRAFIC',
            'heroTitle' => 'Choisissez votre lot d\'articles',
            'heroSubtitle' => '',
            'bannerText' => 'Article gratuit des 10 euro',
            'ctaLabel' => 'Payer le lot promo',
            'shareTitle' => 'Partagez votre lien',
            'shareDescription' => '',
            'itemLimit' => 7,
            'fixedPriceEur' => 10,
            'referralGoal' => 20,
            'dealTagText' => '-60%',
            'productBadgeText' => 'Free',
            'compareAtMultiplier' => 1.55,
            'compareAtExtraEur' => 1.25,
            'productSlugs' => [],
        ];

        if (! File::exists($path)) {
            return $default;
        }

        $decoded = json_decode((string) File::get($path), true);

        return is_array($decoded) ? array_merge($default, $decoded) : $default;
    }

    protected function products(array $slugs): array
    {
        try {
            $models = Product::query()
                ->whereIn('slug', $slugs)
                ->get()
                ->keyBy('slug');
        } catch (Throwable) {
            $models = collect();
        }

        return collect($slugs)->map(function (string $slug) use ($models) {
            $product = $models->get($slug);
            $metadata = is_array($product?->metadata) ? $product->metadata : [];

            return [
                'slug' => $slug,
                'title' => $product?->title ?? str_replace('-', ' ', $slug),
                'shortTitle' => $metadata['shortTitle'] ?? $product?->title ?? str_replace('-', ' ', $slug),
                'image' => $product?->image ?? '/globe.svg',
                'supplierName' => $product?->supplier_name ?? 'AfriPay Supplier',
            ];
        })->all();
    }

    protected function fixedPriceFcfa(float $priceEur): int
    {
        return (int) round($priceEur * 655.957);
    }
}