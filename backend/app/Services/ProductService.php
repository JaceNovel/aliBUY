<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
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
        $page = max((int) $request->integer('page', 1), 1);

        if ($query === '') {
            $products = Product::query()
                ->where('is_published', true)
                ->latest()
                ->paginate($perPage);

            return $this->feedPayload($products, ['query' => $query, 'source' => 'search']);
        }

        $products = $this->paginateSearchProducts($query, $perPage, $page);

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
            'moqVerified' => (bool) ($metadata['moqVerified'] ?? false),
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
        $variantSkus = $this->normalizeVariantSkus($metadata['variantSkus'] ?? null);
        $variantGroups = $metadata['variantGroups'] ?? [];

        if ((! is_array($variantGroups) || $variantGroups === []) && $variantSkus !== []) {
            $variantGroups = $this->buildVariantGroupsFromSkus($variantSkus);
        }

        return [
            'slug' => $product->slug,
            'title' => $product->title,
            'shortTitle' => $metadata['shortTitle'] ?? $product->title,
            'description' => $this->resolvePublicDescription($product, $metadata),
            'image' => (string) ($product->image ?? '/globe.svg'),
            'gallery' => $gallery,
            'videoUrl' => $metadata['videoUrl'] ?? null,
            'videoPoster' => $metadata['videoPoster'] ?? null,
            'badge' => $product->badge,
            'minUsd' => (float) $product->price,
            'maxUsd' => $metadata['maxUsd'] ?? null,
            'moq' => (int) ($product->moq ?? 1),
            'moqVerified' => (bool) ($metadata['moqVerified'] ?? false),
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
            'variantGroups' => $variantGroups,
            'variantPricing' => $metadata['variantPricing'] ?? [],
            'variantSkus' => $variantSkus,
            'specs' => $metadata['specs'] ?? [],
            'keywords' => $metadata['keywords'] ?? [],
            'rawPayload' => is_array($metadata['rawPayload'] ?? null) ? $metadata['rawPayload'] : null,
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

    protected function resolvePublicDescription(Product $product, array $metadata = []): string
    {
        $candidates = [
            $product->description,
            $metadata['description'] ?? null,
        ];

        $rawPayload = is_array($metadata['rawPayload'] ?? null) ? $metadata['rawPayload'] : null;
        if (is_array($rawPayload)) {
            $detailPayload = is_array($rawPayload['detail'] ?? null) ? $rawPayload['detail'] : [];
            $searchPayload = is_array($rawPayload['search'] ?? null) ? $rawPayload['search'] : [];
            $baseInfo = is_array($detailPayload['ae_item_base_info_dto'] ?? null) ? $detailPayload['ae_item_base_info_dto'] : [];

            $candidates = array_merge($candidates, [
                $baseInfo['detail'] ?? null,
                $baseInfo['mobile_detail'] ?? null,
                $detailPayload['detail'] ?? null,
                $detailPayload['mobile_detail'] ?? null,
                $detailPayload['description'] ?? null,
                $searchPayload['description'] ?? null,
            ]);
        }

        foreach ($candidates as $candidate) {
            if (! is_string($candidate)) {
                continue;
            }

            $normalized = trim(html_entity_decode(strip_tags($candidate), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $normalized = preg_replace('/\s+/', ' ', $normalized) ?? '';

            if ($this->isUsefulPublicDescription($normalized)) {
                return $normalized;
            }
        }

        return trim((string) ($product->description ?? $product->title ?? ''));
    }

    protected function isUsefulPublicDescription(string $value): bool
    {
        if ($value === '' || mb_strlen($value) < 12) {
            return false;
        }

        return preg_match('/(reconstruit depuis|selection afripay|catalogue afripay|fiche verifiee afripay|produit aliexpress|produit importe sans sku)/iu', $value) !== 1;
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

    protected function paginateSearchProducts(string $query, int $perPage, int $page): LengthAwarePaginator
    {
        $products = $this->searchPublishedProducts($query);
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

    protected function searchPublishedProducts(string $query): Collection
    {
        $normalizedQuery = $this->normalizeSearchText($query);
        if ($normalizedQuery === '') {
            return collect();
        }

        $searchTerms = $this->expandSearchTerms($query);
        $ranked = Product::query()
            ->where('is_published', true)
            ->latest()
            ->get()
            ->map(function (Product $product) use ($normalizedQuery, $searchTerms) {
                return [
                    'product' => $product,
                    'score' => $this->scorePublishedProductSearch($product, $normalizedQuery, $searchTerms),
                ];
            })
            ->filter(fn (array $entry) => $entry['score'] > 0)
            ->values()
            ->all();

        usort($ranked, function (array $left, array $right) {
            $scoreComparison = $right['score'] <=> $left['score'];
            if ($scoreComparison !== 0) {
                return $scoreComparison;
            }

            /** @var Product $leftProduct */
            $leftProduct = $left['product'];
            /** @var Product $rightProduct */
            $rightProduct = $right['product'];

            return strcmp((string) $rightProduct->created_at, (string) $leftProduct->created_at);
        });

        return collect($ranked)->map(fn (array $entry) => $entry['product'])->values();
    }

    protected function scorePublishedProductSearch(Product $product, string $normalizedQuery, array $searchTerms): int
    {
        $title = $this->normalizeSearchText($product->title);
        $metadata = is_array($product->metadata) ? $product->metadata : [];
        $shortTitle = $this->normalizeSearchText((string) ($metadata['shortTitle'] ?? ''));
        $description = $this->normalizeSearchText((string) ($product->description ?? ''));
        $slug = $this->normalizeSearchText((string) $product->slug);
        $categoryTitle = $this->normalizeSearchText($this->resolveCategoryTitle($product));
        $categoryPath = $this->normalizeSearchText(implode(' ', $this->resolveCategoryPath($product)));
        $supplierName = $this->normalizeSearchText((string) ($product->supplier_name ?? ''));
        $keywords = collect($metadata['keywords'] ?? [])
            ->filter(fn ($entry) => is_string($entry) && trim($entry) !== '')
            ->map(fn (string $entry) => $this->normalizeSearchText($entry))
            ->filter()
            ->values()
            ->all();
        $specs = collect($metadata['specs'] ?? [])
            ->filter(fn ($entry) => is_array($entry))
            ->map(function (array $entry) {
                $label = isset($entry['label']) ? (string) $entry['label'] : '';
                $value = isset($entry['value']) ? (string) $entry['value'] : '';

                return $this->normalizeSearchText(trim($label.' '.$value));
            })
            ->filter()
            ->values()
            ->all();

        $combined = trim(implode(' ', array_filter([
            $title,
            $shortTitle,
            $description,
            $slug,
            $categoryTitle,
            $categoryPath,
            $supplierName,
            implode(' ', $keywords),
            implode(' ', $specs),
        ])));

        if ($combined === '') {
            return 0;
        }

        $score = 0;
        $matchedTerms = 0;

        if ($title === $normalizedQuery) {
            $score += 240;
        }

        if ($shortTitle !== '' && $shortTitle === $normalizedQuery) {
            $score += 210;
        }

        if (str_contains($title, $normalizedQuery)) {
            $score += 160;
        }

        if ($shortTitle !== '' && str_contains($shortTitle, $normalizedQuery)) {
            $score += 130;
        }

        if (str_contains($categoryTitle, $normalizedQuery) || str_contains($categoryPath, $normalizedQuery)) {
            $score += 80;
        }

        if (str_contains($description, $normalizedQuery) || str_contains($slug, $normalizedQuery)) {
            $score += 70;
        }

        if (collect($keywords)->contains(fn (string $entry) => str_contains($entry, $normalizedQuery))) {
            $score += 90;
        }

        if (collect($specs)->contains(fn (string $entry) => str_contains($entry, $normalizedQuery))) {
            $score += 70;
        }

        foreach ($searchTerms as $term) {
            if ($term === '') {
                continue;
            }

            $termScore = 0;
            if (str_contains($title, $term)) {
                $termScore = 34;
            } elseif ($shortTitle !== '' && str_contains($shortTitle, $term)) {
                $termScore = 28;
            } elseif (collect($keywords)->contains(fn (string $entry) => str_contains($entry, $term))) {
                $termScore = 22;
            } elseif (collect($specs)->contains(fn (string $entry) => str_contains($entry, $term))) {
                $termScore = 18;
            } elseif (str_contains($categoryTitle, $term) || str_contains($categoryPath, $term)) {
                $termScore = 18;
            } elseif (str_contains($description, $term) || str_contains($supplierName, $term) || str_contains($slug, $term) || str_contains($combined, $term)) {
                $termScore = 12;
            }

            if ($termScore > 0) {
                $matchedTerms++;
                $score += $termScore;
            }
        }

        if ($matchedTerms === 0 && ! str_contains($combined, $normalizedQuery)) {
            return 0;
        }

        if ($matchedTerms >= max(1, min(count($searchTerms), 2))) {
            $score += 36;
        }

        return $score;
    }

    protected function expandSearchTerms(string $query): array
    {
        $normalizedQuery = $this->normalizeSearchText($query);
        if ($normalizedQuery === '') {
            return [];
        }

        $terms = [$normalizedQuery];
        $tokens = preg_split('/\s+/', $normalizedQuery) ?: [];

        $synonyms = [
            'ecouteur' => ['earbud', 'earbuds', 'earphone', 'earphones', 'headphone', 'headphones', 'headset'],
            'ecouteurs' => ['earbud', 'earbuds', 'earphone', 'earphones', 'headphone', 'headphones', 'headset'],
            'casque' => ['headphone', 'headphones', 'headset', 'gaming headset'],
            'casques' => ['headphone', 'headphones', 'headset', 'gaming headset'],
            'montre' => ['watch', 'watches', 'smart watch', 'smartwatch'],
            'montres' => ['watch', 'watches', 'smart watch', 'smartwatch'],
            'telephone' => ['phone', 'phones', 'smartphone', 'mobile'],
            'telephones' => ['phone', 'phones', 'smartphone', 'mobile'],
            'ecran' => ['screen', 'display', 'monitor'],
            'chargeur' => ['charger', 'charging', 'adapter'],
        ];

        foreach ($tokens as $token) {
            if (mb_strlen($token) < 2) {
                continue;
            }

            $terms[] = $token;

            foreach ($synonyms[$token] ?? [] as $synonym) {
                $normalizedSynonym = $this->normalizeSearchText($synonym);
                if ($normalizedSynonym !== '') {
                    $terms[] = $normalizedSynonym;
                }
            }
        }

        return array_values(array_unique(array_filter($terms)));
    }

    protected function normalizeSearchText(string $value): string
    {
        $ascii = Str::of($value)->ascii()->lower()->value();
        $normalized = preg_replace('/[^a-z0-9]+/', ' ', $ascii) ?? '';

        return trim(preg_replace('/\s+/', ' ', $normalized) ?? '');
    }

    protected function normalizeCategoryLabel(string $value): string
    {
        return trim(preg_replace('/\s+/', ' ', str_replace(['>', '/', '|', '_'], ' ', $value)) ?? '');
    }

    protected function normalizeVariantSkus(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter(array_map(function ($entry) {
            if (! is_array($entry)) {
                return null;
            }

            $skuId = isset($entry['skuId']) ? trim((string) $entry['skuId']) : '';
            if ($skuId === '') {
                return null;
            }

            $selections = [];
            if (is_array($entry['selections'] ?? null)) {
                foreach ($entry['selections'] as $label => $selectionValue) {
                    $normalizedLabel = trim((string) $label);
                    $normalizedValue = is_scalar($selectionValue) ? trim((string) $selectionValue) : '';
                    if ($normalizedLabel !== '' && $normalizedValue !== '') {
                        $selections[$normalizedLabel] = $normalizedValue;
                    }
                }
            }

            if ($selections === []) {
                $selections = $this->extractSelectionsFromVariantLabel($entry['label'] ?? null);
            }

            $normalized = array_filter([
                'skuId' => $skuId,
                'skuCode' => isset($entry['skuCode']) ? trim((string) $entry['skuCode']) : (isset($entry['sku_code']) ? trim((string) $entry['sku_code']) : null),
                'inventory' => isset($entry['inventory']) && is_numeric($entry['inventory']) ? (int) $entry['inventory'] : null,
                'image' => isset($entry['image']) ? trim((string) $entry['image']) : null,
                'label' => isset($entry['label']) ? trim((string) $entry['label']) : null,
                'selections' => $selections !== [] ? $selections : null,
            ], fn ($candidate) => $candidate !== null && $candidate !== '');

            return $normalized !== [] ? $normalized : null;
        }, $value)));
    }

    protected function extractSelectionsFromVariantLabel(mixed $value): array
    {
        if (! is_string($value) || trim($value) === '') {
            return [];
        }

        $segments = preg_split('/\s*\/\s*/', trim($value)) ?: [];
        $selections = [];

        foreach ($segments as $segment) {
            $match = preg_match('/^([^:]+):\s*(.+)$/', trim($segment), $parts);
            if ($match !== 1) {
                continue;
            }

            $label = trim((string) ($parts[1] ?? ''));
            $selectionValue = trim((string) ($parts[2] ?? ''));
            if ($label !== '' && $selectionValue !== '') {
                $selections[$label] = $selectionValue;
            }
        }

        return $selections;
    }

    protected function buildVariantGroupsFromSkus(array $variantSkus): array
    {
        $groups = [];

        foreach ($variantSkus as $sku) {
            if (! is_array($sku) || ! is_array($sku['selections'] ?? null)) {
                continue;
            }

            foreach ($sku['selections'] as $label => $value) {
                $normalizedLabel = trim((string) $label);
                $normalizedValue = trim((string) $value);
                if ($normalizedLabel === '' || $normalizedValue === '') {
                    continue;
                }

                $groups[$normalizedLabel] ??= [];
                if (! in_array($normalizedValue, $groups[$normalizedLabel], true)) {
                    $groups[$normalizedLabel][] = $normalizedValue;
                }
            }
        }

        return array_values(array_map(
            fn (string $label, array $values) => ['label' => $label, 'values' => array_values($values)],
            array_keys($groups),
            array_values($groups),
        ));
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
