<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('limit', 20), 1), 40);
        $products = Product::query()
            ->latest()
            ->paginate($perPage);

        return response()->json($this->feedPayload($products));
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json([
            'product' => $this->transformProduct($product),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        $perPage = min(max((int) $request->integer('limit', 20), 1), 40);

        $products = Product::query()
            ->when($query !== '', function ($builder) use ($query) {
                $builder->where(function ($nested) use ($query) {
                    $nested->where('title', 'ilike', "%{$query}%")
                        ->orWhere('description', 'ilike', "%{$query}%")
                        ->orWhere('category', 'ilike', "%{$query}%");
                });
            })
            ->latest()
            ->paginate($perPage);

        return response()->json($this->feedPayload($products, ['query' => $query, 'source' => 'search']));
    }

    public function featured(Request $request): JsonResponse
    {
        $limit = min(max((int) $request->integer('limit', 8), 1), 24);
        $items = Product::query()
            ->orderByDesc('views_count')
            ->limit($limit)
            ->get();

        return response()->json([
            'items' => $items->map(fn (Product $product) => $this->transformFeedItem($product))->values(),
            'page' => 1,
            'nextPage' => null,
            'hasMore' => false,
            'pageSize' => $limit,
            'source' => 'featured',
            'mode' => (string) $request->query('mode', 'recommended'),
        ]);
    }

    public function categories(): JsonResponse
    {
        $items = Product::query()
            ->selectRaw('category as slug, category as title, count(*) as product_count')
            ->groupBy('category')
            ->orderBy('category')
            ->get()
            ->map(fn ($row) => [
                'slug' => $row->slug,
                'title' => $row->title,
                'productCount' => (int) $row->product_count,
            ]);

        return response()->json(['items' => $items]);
    }

    public function category(string $slug): JsonResponse
    {
        $count = Product::query()->where('category', $slug)->count();

        return response()->json([
            'category' => $count > 0
                ? ['slug' => $slug, 'title' => $slug, 'productCount' => $count]
                : null,
        ]);
    }

    public function related(Product $product, Request $request): JsonResponse
    {
        $limit = min(max((int) $request->integer('limit', 4), 1), 12);
        $items = Product::query()
            ->whereKeyNot($product->getKey())
            ->where('category', $product->category)
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (Product $item) => $this->transformProduct($item))
            ->values();

        return response()->json(['items' => $items]);
    }

    public function trackView(Product $product): JsonResponse
    {
        $product->increment('views_count');

        return response()->json([], 204);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $product = Product::create($request->validated());

        return response()->json(['product' => $this->transformProduct($product)], 201);
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $product->fill($request->validated())->save();

        return response()->json(['product' => $this->transformProduct($product)]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json([], 204);
    }

    protected function feedPayload($products, array $extra = []): array
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

    protected function transformFeedItem(Product $product): array
    {
        return [
            'slug' => $product->slug,
            'title' => $product->title,
            'image' => (string) ($product->image ?? '/globe.svg'),
            'badge' => $product->badge,
            'minUsd' => (float) $product->price,
            'maxUsd' => null,
            'moq' => (int) ($product->moq ?? 1),
            'unit' => (string) ($product->unit ?? 'piece'),
        ];
    }

    protected function transformProduct(Product $product): array
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
            'overview' => $metadata['overview'] ?? [],
            'tiers' => $metadata['tiers'] ?? [],
            'variantGroups' => $metadata['variantGroups'] ?? [],
            'variantPricing' => $metadata['variantPricing'] ?? [],
            'specs' => $metadata['specs'] ?? [],
            'keywords' => $metadata['keywords'] ?? [],
        ];
    }
}
