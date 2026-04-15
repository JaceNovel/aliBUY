<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Throwable;
use Illuminate\Validation\ValidationException;

class ProductService
{
    public function __construct(
        protected AliExpressPublicProductService $aliExpressPublicProducts,
    ) {
    }

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
        $categories = [];

        foreach (Product::query()->where('is_published', true)->get() as $product) {
            $category = $this->resolvePublicCategory($product);
            $slug = $category['slug'];

            if (! isset($categories[$slug])) {
                $categories[$slug] = [
                    'slug' => $slug,
                    'title' => $category['title'],
                    'productCount' => 0,
                    'image' => (string) ($product->image ?? '/globe.svg'),
                    'sourcePath' => $category['path'],
                    'sourcePathLabel' => implode(' / ', $category['path']),
                ];
            }

            $categories[$slug]['productCount']++;
            if (($categories[$slug]['image'] ?? '') === '/globe.svg' && ! empty($product->image)) {
                $categories[$slug]['image'] = (string) $product->image;
            }
        }

        return collect(array_values($categories))
            ->sortBy('title', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
    }

    public function category(string $slug): ?array
    {
        $products = $this->publishedProductsForResolvedCategory($slug);
        $first = $products->first();
        $resolved = $first instanceof Product ? $this->resolvePublicCategory($first) : null;

        return $first instanceof Product
            ? [
                'slug' => $resolved['slug'],
                'title' => $resolved['title'],
                'productCount' => $products->count(),
                'image' => (string) ($first->image ?? '/globe.svg'),
                'sourcePath' => $resolved['path'],
                'sourcePathLabel' => implode(' / ', $resolved['path']),
            ]
            : null;
    }

    public function categoryFeed(Request $request): array
    {
        $category = trim((string) $request->query('category', ''));
        $perPage = min(max((int) $request->integer('limit', 20), 1), 40);
        $page = max((int) $request->integer('page', 1), 1);

        if ($category === '') {
            return [
                'items' => [],
                'page' => $page,
                'nextPage' => null,
                'hasMore' => false,
                'pageSize' => $perPage,
                'source' => 'category',
                'category' => $category,
            ];
        }

        try {
            $products = $this->paginateResolvedCategoryProducts($category, $perPage, $page);

            return $this->feedPayload($products, ['category' => $category, 'source' => 'category']);
        } catch (Throwable) {
            return [
                'items' => [],
                'page' => $page,
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
        $metadata = is_array($product->metadata) ? $product->metadata : [];
        $gallery = is_array($product->gallery) && $product->gallery !== []
            ? $product->gallery
            : [$product->image ?? '/globe.svg'];

        return [
            'slug' => $product->slug,
            'title' => $product->title,
            'shortTitle' => (string) ($metadata['shortTitle'] ?? $product->title),
            'image' => (string) ($product->image ?? '/globe.svg'),
            'gallery' => $gallery,
            'videoUrl' => $metadata['videoUrl'] ?? null,
            'videoPoster' => $metadata['videoPoster'] ?? null,
            'badge' => $product->badge,
            'minUsd' => (float) $product->price,
            'maxUsd' => $metadata['maxUsd'] ?? null,
            'moq' => (int) ($product->moq ?? 1),
            'moqVerified' => (bool) ($metadata['moqVerified'] ?? true),
            'weightVerified' => (bool) ($metadata['weightVerified'] ?? (((int) ($metadata['itemWeightGrams'] ?? 0)) > 0)),
            'priceVerified' => (bool) ($metadata['priceVerified'] ?? true),
            'unit' => (string) ($product->unit ?? 'piece'),
            'categorySlug' => (string) $product->category,
            'categoryTitle' => $this->resolveCategoryTitle($product),
            'categoryPath' => $this->resolveCategoryPath($product),
        ];
    }

    public function transformProduct(Product $product): array
    {
        $metadata = $product->metadata ?? [];
        $gallery = is_array($product->gallery) && $product->gallery !== []
            ? $product->gallery
            : [$product->image ?? '/globe.svg'];

        return [
            'slug' => $product->slug,
            'title' => $product->title,
            'shortTitle' => $metadata['shortTitle'] ?? $product->title,
            'image' => (string) ($product->image ?? '/globe.svg'),
            'gallery' => $gallery,
            'videoUrl' => $metadata['videoUrl'] ?? null,
            'videoPoster' => $metadata['videoPoster'] ?? null,
            'badge' => $product->badge,
            'minUsd' => (float) $product->price,
            'maxUsd' => $metadata['maxUsd'] ?? null,
            'moq' => (int) ($product->moq ?? 1),
            'moqVerified' => (bool) ($metadata['moqVerified'] ?? true),
            'weightVerified' => (bool) ($metadata['weightVerified'] ?? (((int) ($metadata['itemWeightGrams'] ?? 0)) > 0)),
            'priceVerified' => (bool) ($metadata['priceVerified'] ?? true),
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
            'chinaLocalFreightFcfa' => isset($metadata['chinaLocalFreightFcfa']) ? (int) $metadata['chinaLocalFreightFcfa'] : null,
            'chinaLocalFreightLabel' => isset($metadata['chinaLocalFreightLabel']) ? (string) $metadata['chinaLocalFreightLabel'] : null,
            'categorySlug' => (string) $product->category,
            'categoryTitle' => $this->resolveCategoryTitle($product),
            'categoryPath' => $this->resolveCategoryPath($product),
            'overview' => $metadata['overview'] ?? [],
            'tiers' => $metadata['tiers'] ?? [],
            'variantGroups' => $metadata['variantGroups'] ?? [],
            'variantPricing' => $metadata['variantPricing'] ?? [],
            'variantSkus' => $metadata['variantSkus'] ?? [],
            'specs' => $metadata['specs'] ?? [],
            'keywords' => $metadata['keywords'] ?? [],
        ];
    }

    public function transformProductDetail(Product $product): array
    {
        $base = $this->transformProduct($product);
        $customerReviews = $this->transformPublishedReviews($product);
        $external = $this->aliExpressPublicProducts->fetchProductSupplement($product);
        $gallery = $this->mergeGallery($base['gallery'] ?? [], $external['gallery'] ?? []);
        $reviewSummary = $this->buildReviewSummary($customerReviews, is_array($external['externalReviewSummary'] ?? null) ? $external['externalReviewSummary'] : null);

        return [
            ...$base,
            'image' => $gallery[0] ?? $base['image'],
            'gallery' => $gallery,
            'sourceUrl' => $external['sourceUrl'] ?? null,
            'reviewSummary' => $reviewSummary,
            'reviews' => $this->mergeReviews($customerReviews, is_array($external['externalReviews'] ?? null) ? $external['externalReviews'] : []),
        ];
    }

    public function listPublishedReviews(Product $product): array
    {
        $product->loadMissing(['reviews' => fn ($query) => $query->where('status', 'published')->latest('submitted_at')]);

        return [
            'reviewSummary' => $this->buildReviewSummary($this->transformPublishedReviews($product), null),
            'reviews' => $this->transformPublishedReviews($product),
        ];
    }

    public function submitReview(Product $product, array $payload): array
    {
        $rating = max(1, min(5, (int) ($payload['rating'] ?? 0)));
        $comment = trim((string) ($payload['comment'] ?? ''));
        $reviewerEmail = Str::lower(trim((string) ($payload['reviewerEmail'] ?? '')));
        $reviewerName = trim((string) ($payload['reviewerName'] ?? ''));
        $reviewerUserId = trim((string) ($payload['reviewerUserId'] ?? ''));
        $mediaUrls = collect($payload['mediaUrls'] ?? [])
            ->filter(fn ($entry) => is_string($entry) && trim($entry) !== '')
            ->map(fn ($entry) => trim((string) $entry))
            ->unique()
            ->take(6)
            ->values()
            ->all();

        if ($rating < 1 || $rating > 5) {
            throw ValidationException::withMessages([
                'rating' => ['La note doit etre comprise entre 1 et 5.'],
            ]);
        }

        if (Str::length($comment) < 8) {
            throw ValidationException::withMessages([
                'comment' => ['Votre avis doit contenir au moins 8 caracteres.'],
            ]);
        }

        if ($reviewerEmail === '' || $reviewerName === '') {
            throw ValidationException::withMessages([
                'reviewer' => ['Connexion requise pour publier un avis.'],
            ]);
        }

        $eligibleOrderItem = $product->orders()
            ->withPivot(['quantity'])
            ->with('orderItems')
            ->where('payment_status', 'paid')
            ->where(function ($query) use ($reviewerEmail, $reviewerUserId) {
                $query->whereRaw('LOWER(customer_email) = ?', [$reviewerEmail]);
                if ($reviewerUserId !== '') {
                    $query->orWhere('user_id', is_numeric($reviewerUserId) ? (int) $reviewerUserId : 0)
                        ->orWhere('user_info->userId', $reviewerUserId);
                }
            })
            ->latest('orders.created_at')
            ->first();

        if (! $eligibleOrderItem) {
            throw ValidationException::withMessages([
                'order' => ['Aucun achat verifie de ce produit n\'a ete trouve pour ce compte.'],
            ]);
        }

        $existing = ProductReview::query()
            ->where('product_id', $product->id)
            ->where('order_id', $eligibleOrderItem->getKey())
            ->where('source', 'customer')
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'order' => ['Un avis existe deja pour cet achat.'],
            ]);
        }

        $review = ProductReview::query()->create([
            'product_id' => $product->id,
            'order_id' => $eligibleOrderItem->getKey(),
            'user_id' => is_numeric($reviewerUserId) ? (int) $reviewerUserId : null,
            'source' => 'customer',
            'reviewer_name' => $reviewerName,
            'reviewer_email' => $reviewerEmail,
            'rating' => $rating,
            'title' => trim((string) ($payload['title'] ?? '')) ?: null,
            'comment' => $comment,
            'media_urls' => $mediaUrls,
            'verified_purchase' => true,
            'status' => 'published',
            'submitted_at' => now(),
            'published_at' => now(),
        ]);

        return [
            'review' => $this->transformReview($review),
            ...$this->listPublishedReviews($product->fresh('reviews')),
        ];
    }

    public function transformUploadedReviewMedia(array $urls): array
    {
        return [
            'urls' => collect($urls)
                ->filter(fn ($entry) => is_string($entry) && trim($entry) !== '')
                ->map(fn ($entry) => trim((string) $entry))
                ->values()
                ->all(),
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

    protected function transformPublishedReviews(Product $product): array
    {
        $reviews = $product->relationLoaded('reviews')
            ? $product->reviews
            : $product->reviews()->where('status', 'published')->latest('submitted_at')->get();

        return $reviews
            ->filter(fn (ProductReview $review) => $review->status === 'published')
            ->map(fn (ProductReview $review) => $this->transformReview($review))
            ->values()
            ->all();
    }

    protected function transformReview(ProductReview $review): array
    {
        return [
            'id' => (string) $review->getKey(),
            'source' => (string) $review->source,
            'reviewerName' => (string) $review->reviewer_name,
            'rating' => (int) $review->rating,
            'title' => $review->title,
            'comment' => (string) $review->comment,
            'mediaUrls' => is_array($review->media_urls) ? array_values($review->media_urls) : [],
            'verifiedPurchase' => (bool) $review->verified_purchase,
            'createdAt' => optional($review->submitted_at ?? $review->created_at)->toIso8601String(),
            'status' => (string) $review->status,
        ];
    }

    protected function mergeGallery(array $baseGallery, array $externalGallery): array
    {
        return collect([...$baseGallery, ...$externalGallery])
            ->filter(fn ($entry) => is_string($entry) && trim($entry) !== '')
            ->map(fn (string $entry) => trim($entry))
            ->unique()
            ->values()
            ->all();
    }

    protected function mergeReviews(array $customerReviews, array $externalReviews): array
    {
        return collect([...$customerReviews, ...$externalReviews])
            ->filter(fn ($entry) => is_array($entry))
            ->sortByDesc(fn (array $entry) => (string) ($entry['createdAt'] ?? ''))
            ->values()
            ->all();
    }

    protected function buildReviewSummary(array $customerReviews, ?array $externalSummary): array
    {
        $customerCount = count($customerReviews);
        $customerAverage = $customerCount > 0
            ? round(collect($customerReviews)->avg(fn (array $review) => (int) ($review['rating'] ?? 0)), 1)
            : null;
        $externalCount = max(0, (int) ($externalSummary['totalCount'] ?? 0));
        $externalAverage = isset($externalSummary['averageRating']) && is_numeric($externalSummary['averageRating'])
            ? round((float) $externalSummary['averageRating'], 1)
            : null;
        $weightedTotal = ($customerAverage ?? 0) * $customerCount + ($externalAverage ?? 0) * $externalCount;
        $totalCount = $customerCount + $externalCount;
        $averageRating = $totalCount > 0 ? round($weightedTotal / $totalCount, 1) : null;
        $withMediaCount = collect($customerReviews)->filter(fn (array $review) => ! empty($review['mediaUrls']))->count()
            + max(0, (int) ($externalSummary['displayCount'] ?? 0));

        return [
            'averageRating' => $averageRating,
            'totalCount' => $totalCount,
            'customerCount' => $customerCount,
            'externalCount' => $externalCount,
            'customerAverageRating' => $customerAverage,
            'externalAverageRating' => $externalAverage,
            'withMediaCount' => $withMediaCount,
        ];
    }

    protected function resolvePublicCategory(Product $product): array
    {
        $path = array_values(array_filter(array_map(
            fn ($entry) => is_string($entry) ? trim($entry) : '',
            $this->resolveCategoryPath($product)
        )));
        $usefulPath = array_values(array_filter($path, fn ($entry) => $this->isUsefulCategoryLabel($entry)));
        $path = $usefulPath !== [] ? $usefulPath : $path;

        $title = $this->resolveCategoryTitle($product);
        if (! $this->isUsefulCategoryLabel($title) && $path !== []) {
            $title = (string) end($path);
        }

        $columnCategory = trim((string) $product->category);
        if (! $this->isUsefulCategoryLabel($title) && $this->isUsefulCategorySlug($columnCategory)) {
            $title = str_replace('-', ' ', $columnCategory);
        }

        if (! $this->isUsefulCategoryLabel($title)) {
            $title = 'Autres produits';
        }

        if ($path === []) {
            $path = [$title];
        }

        $slug = $this->isUsefulCategorySlug($columnCategory)
            ? $columnCategory
            : $this->slugifyCategoryLabel($title);

        return [
            'slug' => $slug !== '' ? $slug : 'autres-produits',
            'title' => $title,
            'path' => $path,
        ];
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

    protected function publishedProductsForResolvedCategory(string $slug)
    {
        return Product::query()
            ->where('is_published', true)
            ->latest()
            ->get()
            ->filter(fn (Product $product) => $this->resolvePublicCategory($product)['slug'] === $slug)
            ->values();
    }

    protected function paginateResolvedCategoryProducts(string $slug, int $perPage, int $page): LengthAwarePaginator
    {
        $products = $this->publishedProductsForResolvedCategory($slug);
        $total = $products->count();
        $items = $products->slice(($page - 1) * $perPage, $perPage)->values()->all();

        return new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $page,
            ['path' => LengthAwarePaginator::resolveCurrentPath()]
        );
    }

    protected function normalizeCategoryLabel(string $value): string
    {
        return trim(preg_replace('/\s+/', ' ', str_replace(['>', '/', '|', '_'], ' ', $value)) ?? '');
    }

    protected function isUsefulCategoryLabel(?string $value): bool
    {
        if (! is_string($value)) {
            return false;
        }

        $normalized = $this->normalizeCategoryLabel($value);
        if ($normalized === '' || mb_strlen($normalized) < 2 || mb_strlen($normalized) > 80) {
            return false;
        }

        if (! preg_match('/[\p{L}]/u', $normalized)) {
            return false;
        }

        return ! preg_match('/^(catalogue importe|produit aliexpress|produit alibaba|aliexpress|alibaba|general|misc|other|others|undefined|null|n\/?a|na|unknown|sans nom|untitled)$/iu', $normalized);
    }

    protected function isUsefulCategorySlug(?string $value): bool
    {
        if (! is_string($value)) {
            return false;
        }

        $normalized = trim($value);
        if ($normalized === '' || preg_match('/^\d+$/', $normalized)) {
            return false;
        }

        return ! preg_match('/^(aliexpress|alibaba|general|misc|other|others)$/i', $normalized);
    }

    protected function slugifyCategoryLabel(string $value): string
    {
        return Str::slug($value);
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
