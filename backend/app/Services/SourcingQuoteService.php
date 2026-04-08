<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\File;

class SourcingQuoteService
{
    public function buildQuote(array $items, array $options = []): array
    {
        $settings = $this->getSettings();
        $normalizedItems = $this->normalizeItems($items);
        if ($normalizedItems === []) {
            return [
                ...$this->createEmptyQuote($settings),
                'settings' => $settings,
            ];
        }

        $productsBySlug = $this->loadProductsBySlug(array_column($normalizedItems, 'slug'));
        $computedItems = [];
        $totalWeightKg = 0.0;
        $totalCbm = 0.0;
        $cartProductsTotalFcfa = 0;

        foreach ($normalizedItems as $item) {
            $product = $productsBySlug[$item['slug']] ?? null;
            $metadata = is_array($product?->metadata) ? $product->metadata : [];
            $quantity = (int) $item['quantity'];
            $weightKg = $this->resolveWeightKg($metadata);
            $volumeCbm = $this->resolveVolumeCbm($metadata);
            $supplierPriceFcfa = $this->resolveSupplierPriceFcfa($product?->price, $metadata);
            $marginAmountFcfa = $this->computeMarginAmount($supplierPriceFcfa, $settings);
            $finalUnitPriceFcfa = $supplierPriceFcfa + $marginAmountFcfa;
            $finalLinePriceFcfa = $finalUnitPriceFcfa * $quantity;

            $computedItems[] = [
                'cartKey' => $this->buildCartItemKey($item['slug'], $item['selectedVariants'] ?? null),
                'slug' => $item['slug'],
                'title' => $product?->title ?? $item['slug'],
                'quantity' => $quantity,
                'selectedVariants' => $item['selectedVariants'] ?? null,
                'selectionLabel' => $this->formatVariantSelection($item['selectedVariants'] ?? null),
                'requiredVariantLabels' => [],
                'missingVariantLabels' => [],
                'variantSelectionComplete' => true,
                'supplierSkuId' => null,
                'supplierSkuCode' => null,
                'weightKg' => $weightKg,
                'volumeCbm' => $volumeCbm,
                'supplierPriceFcfa' => $supplierPriceFcfa,
                'marginMode' => $settings['defaultMarginMode'],
                'marginValue' => $settings['defaultMarginValue'],
                'marginAmountFcfa' => $marginAmountFcfa,
                'finalUnitPriceFcfa' => $finalUnitPriceFcfa,
                'finalLinePriceFcfa' => $finalLinePriceFcfa,
                'image' => $product?->image ?? '/globe.svg',
            ];

            $totalWeightKg += $weightKg * $quantity;
            $totalCbm += $volumeCbm * $quantity;
            $cartProductsTotalFcfa += $finalLinePriceFcfa;
        }

        $totalWeightKg = round($totalWeightKg, 3);
        $totalCbm = round($totalCbm, 4);
        $airCostFcfa = (int) ceil($totalWeightKg * $settings['airRatePerKgFcfa']);
        $seaCostFcfa = (int) ceil($totalCbm * $settings['seaSellRatePerCbmFcfa']);
        $shouldPreferSea = $totalWeightKg > $settings['airWeightThresholdKg'];
        $airIsFree = ! ($options['disableFreeAir'] ?? false)
            && ! $shouldPreferSea
            && $settings['freeAirEnabled']
            && $cartProductsTotalFcfa >= $settings['freeAirThresholdFcfa'];

        if (($options['deliveryMode'] ?? 'direct') === 'forwarder') {
            return [
                'items' => $computedItems,
                'cartProductsTotalFcfa' => $cartProductsTotalFcfa,
                'totalWeightKg' => $totalWeightKg,
                'totalCbm' => $totalCbm,
                'shippingOptions' => [[
                    'key' => 'freight',
                    'label' => 'Fret',
                    'priceFcfa' => 0,
                    'deliveryWindow' => '2-5 jours en Chine',
                    'isFree' => true,
                    'tradeLabel' => 'Transport calcule au moment de la validation du panier',
                    'tradeDescriptor' => 'Transport differe',
                ]],
                'recommendedMethod' => 'freight',
                'freeAirRemainingFcfa' => 0,
                'freeShippingMessage' => 'Le transport est choisi et paye par le client au moment de la validation du panier.',
                'containerProjection' => [
                    'targetCbm' => $settings['containerTargetCbm'],
                    'projectedCbm' => $totalCbm,
                    'projectedFillPercent' => min(100, (int) round(($totalCbm / max($settings['containerTargetCbm'], 0.0001)) * 100)),
                ],
                'settings' => $settings,
            ];
        }

        $shippingOptions = $shouldPreferSea
            ? [
                [
                    'key' => 'air',
                    'label' => 'Avion',
                    'priceFcfa' => $airIsFree ? 0 : $airCostFcfa,
                    'deliveryWindow' => $settings['airEstimatedDays'],
                    'isFree' => $airIsFree,
                    'tradeLabel' => 'Express payant · '.$this->formatFcfa($settings['airRatePerKgFcfa']).'/kg',
                    'tradeDescriptor' => 'Express payant',
                    'tradeRateFcfa' => $settings['airRatePerKgFcfa'],
                    'tradeRateUnit' => 'kg',
                ],
                [
                    'key' => 'sea',
                    'label' => 'Bateau',
                    'priceFcfa' => $seaCostFcfa,
                    'deliveryWindow' => $settings['seaEstimatedDays'],
                    'isFree' => false,
                    'tradeLabel' => 'Groupage · '.$this->formatFcfa($settings['seaSellRatePerCbmFcfa']).'/m3',
                    'tradeDescriptor' => 'Groupage',
                    'tradeRateFcfa' => $settings['seaSellRatePerCbmFcfa'],
                    'tradeRateUnit' => 'm3',
                ],
            ]
            : [[
                'key' => 'air',
                'label' => 'Avion',
                'priceFcfa' => $airIsFree ? 0 : $airCostFcfa,
                'deliveryWindow' => $settings['airEstimatedDays'],
                'isFree' => $airIsFree,
                'tradeLabel' => 'Express · '.$this->formatFcfa($settings['airRatePerKgFcfa']).'/kg',
                'tradeDescriptor' => 'Express',
                'tradeRateFcfa' => $settings['airRatePerKgFcfa'],
                'tradeRateUnit' => 'kg',
            ]];

        return [
            'items' => $computedItems,
            'cartProductsTotalFcfa' => $cartProductsTotalFcfa,
            'totalWeightKg' => $totalWeightKg,
            'totalCbm' => $totalCbm,
            'shippingOptions' => $shippingOptions,
            'recommendedMethod' => $shouldPreferSea ? 'sea' : 'air',
            'freeAirRemainingFcfa' => max($settings['freeAirThresholdFcfa'] - $cartProductsTotalFcfa, 0),
            'freeShippingMessage' => $shouldPreferSea
                ? 'Le moyen de livraison peut etre change si le poids est trop consequent. Pour profiter de la livraison gratuite, les commandes ne doivent pas depasser '.$settings['airWeightThresholdKg'].' kg.'
                : ($airIsFree
                    ? 'Livraison gratuite debloquee des '.$this->formatFcfa($settings['freeAirThresholdFcfa']).' pour une commande ne depassant pas '.$settings['airWeightThresholdKg'].' kg.'
                    : 'Livraison gratuite disponible a partir de '.$this->formatFcfa($settings['freeAirThresholdFcfa']).' si la commande ne depasse pas '.$settings['airWeightThresholdKg'].' kg.'),
            'containerProjection' => [
                'targetCbm' => $settings['containerTargetCbm'],
                'projectedCbm' => $totalCbm,
                'projectedFillPercent' => min(100, (int) round(($totalCbm / max($settings['containerTargetCbm'], 0.0001)) * 100)),
            ],
            'settings' => $settings,
        ];
    }

    protected function createEmptyQuote(array $settings): array
    {
        return [
            'items' => [],
            'cartProductsTotalFcfa' => 0,
            'totalWeightKg' => 0,
            'totalCbm' => 0,
            'shippingOptions' => [],
            'recommendedMethod' => 'air',
            'freeAirRemainingFcfa' => $settings['freeAirThresholdFcfa'],
            'freeShippingMessage' => 'Ajoutez des articles pour calculer le devis sourcing.',
            'containerProjection' => [
                'targetCbm' => $settings['containerTargetCbm'],
                'projectedCbm' => 0,
                'projectedFillPercent' => 0,
            ],
        ];
    }

    protected function getSettings(): array
    {
        $fallback = [
            'currencyCode' => 'XOF',
            'airRatePerKgFcfa' => 10000,
            'airEstimatedDays' => '5-10 jours',
            'seaRealCostPerCbmFcfa' => 180000,
            'seaSellRatePerCbmFcfa' => 210000,
            'seaEstimatedDays' => '20-40 jours',
            'freeAirThresholdFcfa' => 20000,
            'freeAirEnabled' => true,
            'airWeightThresholdKg' => 2.5,
            'containerTargetCbm' => 1,
            'defaultMarginMode' => 'percent',
            'defaultMarginValue' => 10,
            'updatedAt' => '2026-03-23T00:00:00.000Z',
        ];

        $paths = [
            dirname(base_path()).'/data/sourcing/settings.json',
            base_path('data/sourcing/settings.json'),
        ];

        foreach ($paths as $path) {
            if (File::exists($path)) {
                $decoded = json_decode((string) File::get($path), true);
                if (is_array($decoded)) {
                    return array_merge($fallback, $decoded);
                }
            }
        }

        return $fallback;
    }

    protected function loadProductsBySlug(array $slugs): array
    {
        try {
            return Product::query()
                ->whereIn('slug', array_values(array_unique($slugs)))
                ->get()
                ->keyBy('slug')
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    protected function normalizeItems(array $items): array
    {
        return array_values(array_filter(array_map(function ($entry) {
            if (! is_array($entry)) {
                return null;
            }

            $slug = is_string($entry['slug'] ?? null) ? trim((string) $entry['slug']) : '';
            $quantity = (int) ($entry['quantity'] ?? 0);
            if ($slug === '' || $quantity <= 0) {
                return null;
            }

            $selectedVariants = is_array($entry['selectedVariants'] ?? null)
                ? array_filter($entry['selectedVariants'], fn ($value, $key) => is_string($key) && is_string($value) && trim($value) !== '', ARRAY_FILTER_USE_BOTH)
                : null;

            return [
                'slug' => $slug,
                'quantity' => $quantity,
                'selectedVariants' => $selectedVariants ?: null,
            ];
        }, $items)));
    }

    protected function resolveSupplierPriceFcfa(?float $priceUsd, array $metadata): int
    {
        if (isset($metadata['supplierPriceFcfa']) && is_numeric($metadata['supplierPriceFcfa'])) {
            return (int) round((float) $metadata['supplierPriceFcfa']);
        }

        if ($priceUsd !== null) {
            return (int) round($priceUsd * 602);
        }

        return 0;
    }

    protected function resolveWeightKg(array $metadata): float
    {
        if (isset($metadata['weightKg']) && is_numeric($metadata['weightKg'])) {
            return round((float) $metadata['weightKg'], 3);
        }

        if (isset($metadata['itemWeightGrams']) && is_numeric($metadata['itemWeightGrams'])) {
            return round(((float) $metadata['itemWeightGrams']) / 1000, 3);
        }

        return 0.0;
    }

    protected function resolveVolumeCbm(array $metadata): float
    {
        if (isset($metadata['volumeCbm']) && is_numeric($metadata['volumeCbm'])) {
            return round((float) $metadata['volumeCbm'], 4);
        }

        if (isset($metadata['lotCbm']) && is_numeric($metadata['lotCbm'])) {
            return round((float) $metadata['lotCbm'], 4);
        }

        return 0.0;
    }

    protected function computeMarginAmount(int $supplierPriceFcfa, array $settings): int
    {
        if (($settings['defaultMarginMode'] ?? 'percent') === 'fixed') {
            return (int) round((float) $settings['defaultMarginValue']);
        }

        return (int) round(($supplierPriceFcfa * (float) $settings['defaultMarginValue']) / 100);
    }

    protected function buildCartItemKey(string $slug, ?array $selectedVariants): string
    {
        if (! $selectedVariants) {
            return $slug;
        }

        ksort($selectedVariants);
        return $slug.'::'.json_encode($selectedVariants);
    }

    protected function formatVariantSelection(?array $selectedVariants): ?string
    {
        if (! $selectedVariants) {
            return null;
        }

        $parts = [];
        foreach ($selectedVariants as $label => $value) {
            if (is_string($label) && is_string($value)) {
                $parts[] = trim($label).': '.trim($value);
            }
        }

        return $parts !== [] ? implode(' · ', $parts) : null;
    }

    protected function formatFcfa(int|float $amount): string
    {
        return number_format((float) $amount, 0, ',', ' ').' FCFA';
    }
}