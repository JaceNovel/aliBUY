<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\File;

class SourcingQuoteService
{
    public function buildQuote(array $items, array $options = []): array
    {
        $settings = $this->getSettings();
        $effectiveFreeAirThresholdFcfa = $this->resolveFreeAirThresholdFcfa($settings, $options);
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
            $weightKg = $this->resolveWeightKg($metadata, $product);
            $volumeCbm = $this->resolveVolumeCbm($metadata, $product);
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
        $isEuropeanUnionDestination = ($options['deliveryMode'] ?? 'direct') !== 'forwarder'
            && $this->isEuropeanUnionCountry($options['countryCode'] ?? null);
        $europeanExpressFeeFcfa = (int) round((2.99 / 0.92) * 602);
        $shouldPreferSea = $totalWeightKg > $settings['airWeightThresholdKg'];
        $airIsFree = ! $isEuropeanUnionDestination
            && ! ($options['disableFreeAir'] ?? false)
            && ! $shouldPreferSea
            && $settings['freeAirEnabled']
            && $cartProductsTotalFcfa >= $effectiveFreeAirThresholdFcfa;

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

        $shippingOptions = [
            [
                'key' => 'air',
                'label' => $isEuropeanUnionDestination ? 'Express' : 'Avion',
                'priceFcfa' => $isEuropeanUnionDestination ? $europeanExpressFeeFcfa : ($airIsFree ? 0 : $airCostFcfa),
                'deliveryWindow' => $settings['airEstimatedDays'],
                'isFree' => $airIsFree,
                'tradeLabel' => $isEuropeanUnionDestination ? 'Livraison express domicile · 2,99 EUR' : 'Express payant · '.$this->formatFcfa($settings['airRatePerKgFcfa']).'/kg',
                'tradeDescriptor' => $isEuropeanUnionDestination ? null : 'Express payant',
                'tradeRateFcfa' => $isEuropeanUnionDestination ? null : $settings['airRatePerKgFcfa'],
                'tradeRateUnit' => $isEuropeanUnionDestination ? null : 'kg',
            ],
            [
                'key' => 'sea',
                'label' => $isEuropeanUnionDestination ? 'Standard gratuit' : 'Bateau',
                'priceFcfa' => $isEuropeanUnionDestination ? 0 : $seaCostFcfa,
                'deliveryWindow' => $settings['seaEstimatedDays'],
                'isFree' => $isEuropeanUnionDestination,
                'tradeLabel' => $isEuropeanUnionDestination ? 'Livraison standard offerte dans l\'Union europeenne' : 'Groupage · '.$this->formatFcfa($settings['seaSellRatePerCbmFcfa']).'/m3',
                'tradeDescriptor' => $isEuropeanUnionDestination ? null : 'Groupage',
                'tradeRateFcfa' => $isEuropeanUnionDestination ? null : $settings['seaSellRatePerCbmFcfa'],
                'tradeRateUnit' => $isEuropeanUnionDestination ? null : 'm3',
            ],
        ];

        return [
            'items' => $computedItems,
            'cartProductsTotalFcfa' => $cartProductsTotalFcfa,
            'totalWeightKg' => $totalWeightKg,
            'totalCbm' => $totalCbm,
            'shippingOptions' => $shippingOptions,
            'recommendedMethod' => $isEuropeanUnionDestination || $shouldPreferSea ? 'sea' : 'air',
            'freeAirRemainingFcfa' => $isEuropeanUnionDestination ? 0 : max($effectiveFreeAirThresholdFcfa - $cartProductsTotalFcfa, 0),
            'freeShippingMessage' => $isEuropeanUnionDestination
                ? 'Livraison standard gratuite pour les destinations de l\'Union europeenne. Passez en express pour 2,99 EUR.'
                : ($shouldPreferSea
                ? 'Le moyen de livraison peut etre change si le poids est trop consequent. Pour profiter de la livraison gratuite, les commandes ne doivent pas depasser '.$settings['airWeightThresholdKg'].' kg.'
                : ($airIsFree
                    ? 'Livraison gratuite debloquee des '.$this->formatFcfa($effectiveFreeAirThresholdFcfa).' pour une commande ne depassant pas '.$settings['airWeightThresholdKg'].' kg.'
                    : 'Livraison gratuite disponible a partir de '.$this->formatFcfa($effectiveFreeAirThresholdFcfa).' si la commande ne depasse pas '.$settings['airWeightThresholdKg'].' kg.')),
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

    protected function resolveFreeAirThresholdFcfa(array $settings, array $options): int
    {
        if (($options['disableFreeAir'] ?? false) === true) {
            return (int) $settings['freeAirThresholdFcfa'];
        }

        $eurRateFromUsd = 0.92;
        $xofRateFromUsd = 602;

        return (int) round((10 / $eurRateFromUsd) * $xofRateFromUsd);
    }

    protected function isEuropeanUnionCountry(mixed $countryCode): bool
    {
        if (! is_string($countryCode)) {
            return false;
        }

        return in_array(strtoupper(trim($countryCode)), [
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
            'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
        ], true);
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

    protected function resolveWeightKg(array $metadata, ?Product $product = null): float
    {
        if (isset($metadata['weightKg']) && is_numeric($metadata['weightKg'])) {
            $weightKg = (float) $metadata['weightKg'];
            if ($weightKg > 0) {
                return round($weightKg, 3);
            }
        }

        if (isset($metadata['itemWeightGrams']) && is_numeric($metadata['itemWeightGrams'])) {
            $itemWeightGrams = (float) $metadata['itemWeightGrams'];
            if ($itemWeightGrams > 0) {
                return round($itemWeightGrams / 1000, 3);
            }
        }

        $volumeCbm = $this->resolveLotCbmValue($metadata, $product);
        if ($volumeCbm > 0) {
            return round(max($volumeCbm * 140, 0.25), 3);
        }

        return round($this->inferFallbackWeightKg($metadata, $product), 3);
    }

    protected function resolveVolumeCbm(array $metadata, ?Product $product = null): float
    {
        if (isset($metadata['volumeCbm']) && is_numeric($metadata['volumeCbm'])) {
            $volumeCbm = (float) $metadata['volumeCbm'];
            if ($volumeCbm > 0) {
                return round($volumeCbm, 4);
            }
        }

        $lotCbm = $this->resolveLotCbmValue($metadata, $product);
        if ($lotCbm > 0) {
            return round($lotCbm, 4);
        }

        $dimensions = $this->resolvePackageDimensionsCm($metadata, $product);
        if ($dimensions !== null) {
            return round(($dimensions['lengthCm'] * $dimensions['widthCm'] * $dimensions['heightCm']) / 1_000_000, 4);
        }

        return round($this->inferFallbackVolumeCbm($metadata, $product), 4);
    }

    protected function resolveLotCbmValue(array $metadata, ?Product $product = null): float
    {
        if (isset($metadata['lotCbm']) && is_numeric($metadata['lotCbm'])) {
            $lotCbm = (float) $metadata['lotCbm'];
            if ($lotCbm > 0) {
                return $lotCbm;
            }
        }

        $dimensions = $this->resolvePackageDimensionsCm($metadata, $product);
        if ($dimensions === null) {
            return 0.0;
        }

        return ($dimensions['lengthCm'] * $dimensions['widthCm'] * $dimensions['heightCm']) / 1_000_000;
    }

    protected function resolvePackageDimensionsCm(array $metadata, ?Product $product = null): ?array
    {
        $dimensions = $metadata['packageDimensionsCm'] ?? null;
        if (is_array($dimensions)) {
            $length = isset($dimensions['lengthCm']) && is_numeric($dimensions['lengthCm']) ? (float) $dimensions['lengthCm'] : 0.0;
            $width = isset($dimensions['widthCm']) && is_numeric($dimensions['widthCm']) ? (float) $dimensions['widthCm'] : 0.0;
            $height = isset($dimensions['heightCm']) && is_numeric($dimensions['heightCm']) ? (float) $dimensions['heightCm'] : 0.0;
            if ($length > 0 && $width > 0 && $height > 0) {
                return [
                    'lengthCm' => round($length, 1),
                    'widthCm' => round($width, 1),
                    'heightCm' => round($height, 1),
                ];
            }
        }

        return $this->inferFallbackDimensionsCm($metadata, $product);
    }

    protected function inferFallbackWeightKg(array $metadata, ?Product $product = null): float
    {
        $haystack = $this->buildProductHaystack($metadata, $product);

        if (preg_match('/jewelry|bijou|bracelet|necklace|pendant|ring|earring/i', $haystack) === 1) {
            return 0.02;
        }

        if (preg_match('/keyboard|clavier/i', $haystack) === 1) {
            return 0.85;
        }

        if (preg_match('/mouse|souris/i', $haystack) === 1) {
            return 0.18;
        }

        if (preg_match('/shoe|chaussure|boot|sneaker|bag|sac/i', $haystack) === 1) {
            return 0.95;
        }

        if (preg_match('/phone|smartphone|tablet|ipad/i', $haystack) === 1) {
            return 0.25;
        }

        return 0.25;
    }

    protected function inferFallbackDimensionsCm(array $metadata, ?Product $product = null): ?array
    {
        $haystack = $this->buildProductHaystack($metadata, $product);

        if (preg_match('/jewelry|bijou|bracelet|necklace|pendant|ring|earring/i', $haystack) === 1) {
            return ['lengthCm' => 8.0, 'widthCm' => 6.0, 'heightCm' => 2.0];
        }

        if (preg_match('/keyboard|clavier/i', $haystack) === 1) {
            return ['lengthCm' => 46.0, 'widthCm' => 16.0, 'heightCm' => 5.0];
        }

        if (preg_match('/mouse|souris/i', $haystack) === 1) {
            return ['lengthCm' => 14.0, 'widthCm' => 9.0, 'heightCm' => 5.0];
        }

        if (preg_match('/shoe|chaussure|boot|sneaker|bag|sac/i', $haystack) === 1) {
            return ['lengthCm' => 34.0, 'widthCm' => 22.0, 'heightCm' => 12.0];
        }

        if (preg_match('/phone|smartphone|tablet|ipad/i', $haystack) === 1) {
            return ['lengthCm' => 18.0, 'widthCm' => 10.0, 'heightCm' => 5.0];
        }

        return ['lengthCm' => 24.0, 'widthCm' => 16.0, 'heightCm' => 8.0];
    }

    protected function inferFallbackVolumeCbm(array $metadata, ?Product $product = null): float
    {
        $dimensions = $this->inferFallbackDimensionsCm($metadata, $product);
        if ($dimensions === null) {
            return 0.0;
        }

        return ($dimensions['lengthCm'] * $dimensions['widthCm'] * $dimensions['heightCm']) / 1_000_000;
    }

    protected function buildProductHaystack(array $metadata, ?Product $product = null): string
    {
        $specs = [];
        if (is_array($metadata['specs'] ?? null)) {
            foreach ($metadata['specs'] as $spec) {
                if (! is_array($spec)) {
                    continue;
                }

                $label = is_string($spec['label'] ?? null) ? trim((string) $spec['label']) : '';
                $value = is_string($spec['value'] ?? null) ? trim((string) $spec['value']) : '';
                if ($label !== '' || $value !== '') {
                    $specs[] = trim($label.' '.$value);
                }
            }
        }

        return mb_strtolower(trim(implode(' ', array_filter([
            is_string($product?->title) ? $product->title : '',
            is_string($product?->category) ? $product->category : '',
            is_string($metadata['shortTitle'] ?? null) ? (string) $metadata['shortTitle'] : '',
            is_string($metadata['packaging'] ?? null) ? (string) $metadata['packaging'] : '',
            is_string($metadata['unit'] ?? null) ? (string) $metadata['unit'] : '',
            implode(' ', $specs),
        ]))));
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