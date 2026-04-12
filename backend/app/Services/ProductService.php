<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Throwable;

class ProductService
{
    public function index(Request $request): array
    {
        $perPage = min(max((int) $request->integer('limit', 20), 1), 40);
        $products = Product::query()
            ->where('is_published', true)
            ->latest()
            ->paginate($perPage);

        return $this->feedPayload($products);
    }

    public function search(Request $request): array
    {
        $query = trim((string) $request->query('q', ''));
        $perPage = min(max((int) $request->integer('limit', 20), 1), 40);

        $products = Product::query()
            ->where('is_published', true)
            ->when($query !== '', function ($builder) use ($query) {
                $builder->where(function ($nested) use ($query) {
                    $likeQuery = '%'.$query.'%';
                    $nested->where('title', 'like', $likeQuery)
                        ->orWhere('description', 'like', $likeQuery)
                        ->orWhere('category', 'like', $likeQuery)
                        ->orWhere('slug', 'like', $likeQuery);
                });
            })
            ->latest()
            ->paginate($perPage);

        return $this->feedPayload($products, ['query' => $query, 'source' => 'search']);
    }

    public function featured(Request $request): array
    {
        $limit = min(max((int) $request->integer('limit', 8), 1), 24);
        $items = Product::query()
            ->where('is_published', true)
            ->orderByDesc('views_count')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return [
            'items' => $items->map(fn (Product $product) => $this->transformFeedItem($product))->values(),
            'page' => 1,
            'nextPage' => null,
            'hasMore' => false,
            'pageSize' => $limit,
            'source' => 'featured',
            'mode' => (string) $request->query('mode', 'recommended'),
        ];
    }

    public function categories()
    {
        return Product::query()
            ->where('is_published', true)
            ->get()
            ->groupBy('category')
            ->map(function ($products, $slug) {
                $first = $products->first();

                return [
                    'slug' => (string) $slug,
                    'title' => $first instanceof Product ? $this->resolveCategoryTitle($first) : (string) $slug,
                    'productCount' => $products->count(),
                    'image' => $first instanceof Product ? (string) ($first->image ?? '/globe.svg') : '/globe.svg',
                    'sourcePath' => $first instanceof Product ? $this->resolveCategoryPath($first) : [(string) $slug],
                    'sourcePathLabel' => implode(' / ', $first instanceof Product ? $this->resolveCategoryPath($first) : [(string) $slug]),
                ];
            })
            ->sortBy('title', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
    }

    public function category(string $slug): ?array
    {
        $products = Product::query()->where('is_published', true)->where('category', $slug)->get();
        $first = $products->first();

        return $first instanceof Product
            ? [
                'slug' => $slug,
                'title' => $this->resolveCategoryTitle($first),
                'productCount' => $products->count(),
                'image' => (string) ($first->image ?? '/globe.svg'),
                'sourcePath' => $this->resolveCategoryPath($first),
                'sourcePathLabel' => implode(' / ', $this->resolveCategoryPath($first)),
            ]
            : null;
    }

    public function categoryFeed(Request $request): array
    {
        $category = trim((string) $request->query('category', ''));
        $perPage = min(max((int) $request->integer('limit', 20), 1), 40);

        if ($category === '') {
            return [
                'items' => [],
                'page' => max((int) $request->integer('page', 1), 1),
                'nextPage' => null,
                'hasMore' => false,
                'pageSize' => $perPage,
                'source' => 'category',
                'category' => $category,
            ];
        }

        try {
            $products = Product::query()
                ->where('is_published', true)
                ->where('category', $category)
                ->latest()
                ->paginate($perPage);

            return $this->feedPayload($products, ['category' => $category, 'source' => 'category']);
        } catch (Throwable) {
            return [
                'items' => [],
                'page' => max((int) $request->integer('page', 1), 1),
                'nextPage' => null,
                'hasMore' => false,
                'pageSize' => $perPage,
                'source' => 'category',
                'category' => $category,
            ];
        }
    }

    public function related(Product $product, Request $request)
    {
        $limit = min(max((int) $request->integer('limit', 4), 1), 12);

        return Product::query()
            ->where('is_published', true)
            ->whereKeyNot($product->getKey())
            ->where('category', $product->category)
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (Product $item) => $this->transformProduct($item))
            ->values();
    }

    public function trackView(Product $product): void
    {
        $product->increment('views_count');
    }

    public function transformFeedItem(Product $product): array
    {
        return [
            'slug' => $product->slug,
            'title' => $product->title,
            'shortTitle' => (string) (($product->metadata ?? [])['shortTitle'] ?? $product->title),
            'image' => (string) ($product->image ?? '/globe.svg'),
            'badge' => $product->badge,
            'minUsd' => (float) $product->price,
            'maxUsd' => $product->metadata['maxUsd'] ?? null,
            'moq' => (int) ($product->moq ?? 1),
            'unit' => (string) ($product->unit ?? 'piece'),
            'categorySlug' => (string) $product->category,
            'categoryTitle' => $this->resolveCategoryTitle($product),
            'categoryPath' => $this->resolveCategoryPath($product),
        ];
    }

    public function transformProduct(Product $product): array
    {
        $metadata = $product->metadata ?? [];

        return [
            'slug' => $product->slug,
            'title' => $product->title,
            'shortTitle' => $metadata['shortTitle'] ?? $product->title,
            'image' => (string) ($product->image ?? '/globe.svg'),
            'gallery' => $product->gallery ?? [$product->image ?? '/globe.svg'],
            'videoUrl' => $metadata['videoUrl'] ?? null,
            'videoPoster' => $metadata['videoPoster'] ?? null,
            'badge' => $product->badge,
            'minUsd' => (float) $product->price,
            'maxUsd' => $metadata['maxUsd'] ?? null,
            'moq' => (int) ($product->moq ?? 1),
            'moqVerified' => (bool) ($metadata['moqVerified'] ?? true),
            'unit' => (string) ($product->unit ?? 'piece'),
            'packaging' => $metadata['packaging'] ?? 'Carton',
            'packageDimensionsCm' => $metadata['packageDimensionsCm'] ?? null,
            'itemWeightGrams' => (int) ($metadata['itemWeightGrams'] ?? 0),
            'lotCbm' => (string) ($metadata['lotCbm'] ?? '0'),
            'supplierName' => (string) ($product->supplier_name ?? 'AfriPay Supplier'),
            'supplierLocation' => (string) ($product->supplier_location ?? 'China'),
            'responseTime' => (string) ($metadata['responseTime'] ?? '24h'),
            'yearsInBusiness' => (int) ($metadata['yearsInBusiness'] ?? 1),
            'transactionsLabel' => (string) ($metadata['transactionsLabel'] ?? 'Transactions verifiees'),
            'soldLabel' => (string) ($metadata['soldLabel'] ?? 'Best seller'),
            'customizationLabel' => (string) ($metadata['customizationLabel'] ?? 'Personnalisation disponible'),
            'shippingLabel' => (string) ($metadata['shippingLabel'] ?? 'Expedition internationale'),
            'categorySlug' => (string) $product->category,
            'categoryTitle' => $this->resolveCategoryTitle($product),
            'categoryPath' => $this->resolveCategoryPath($product),
            'overview' => $metadata['overview'] ?? [],
            'tiers' => $metadata['tiers'] ?? [],
            'variantGroups' => $metadata['variantGroups'] ?? [],
            'variantPricing' => $metadata['variantPricing'] ?? [],
            'specs' => $metadata['specs'] ?? [],
            'keywords' => $metadata['keywords'] ?? [],
        ];
    }

    protected function resolveCategoryTitle(Product $product): string
    {
        $metadata = is_array($product->metadata) ? $product->metadata : [];
        $title = $metadata['categoryTitle'] ?? null;

        if (is_string($title) && trim($title) !== '') {
            return trim($title);
        }

        return str_replace('-', ' ', (string) $product->category);
    }

    protected function resolveCategoryPath(Product $product): array
    {
        $metadata = is_array($product->metadata) ? $product->metadata : [];
        $path = $metadata['categoryPath'] ?? null;

        if (is_array($path)) {
            $normalized = array_values(array_filter(array_map(
                fn ($entry) => is_string($entry) ? trim($entry) : '',
                $path
            )));

            if ($normalized !== []) {
                return $normalized;
            }
        }

        return [$this->resolveCategoryTitle($product)];
    }

    protected function feedPayload(LengthAwarePaginator $products, array $extra = []): array
    {
        return [
            'items' => collect($products->items())->map(fn (Product $product) => $this->transformFeedItem($product))->values(),
            'page' => $products->currentPage(),
            'nextPage' => $products->hasMorePages() ? $products->currentPage() + 1 : null,
            'hasMore' => $products->hasMorePages(),
            'pageSize' => $products->perPage(),
            'source' => $extra['source'] ?? 'catalog',
            'query' => $extra['query'] ?? null,
            'category' => $extra['category'] ?? null,
        ];
    }
}