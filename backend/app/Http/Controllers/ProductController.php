<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function __construct(
        protected ProductService $products,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->products->index($request));
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json(['product' => $this->products->transformProductDetail($product->loadMissing('reviews'))]);
    }

    public function reviews(Product $product): JsonResponse
    {
        return response()->json($this->products->listPublishedReviews($product->loadMissing('reviews')));
    }

    public function storeReview(Product $product, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reviewerName' => ['required', 'string', 'max:255'],
            'reviewerEmail' => ['required', 'email', 'max:255'],
            'reviewerUserId' => ['nullable', 'string', 'max:255'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:255'],
            'comment' => ['required', 'string', 'min:8', 'max:4000'],
            'mediaUrls' => ['nullable', 'array', 'max:6'],
            'mediaUrls.*' => ['string', 'max:2048'],
        ]);

        return response()->json($this->products->submitReview($product, $validated), 201);
    }

    public function uploadReviewMedia(Product $product, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:6'],
            'files.*' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120'],
        ], [
            'files.required' => 'Aucune image transmise.',
            'files.array' => 'Format d\'upload invalide.',
            'files.max' => 'Vous pouvez envoyer au maximum 6 photos.',
            'files.*.mimetypes' => 'Format non pris en charge. Utilisez JPG, PNG ou WEBP.',
            'files.*.max' => 'Chaque photo doit faire au maximum 5 Mo.',
        ]);

        $directory = public_path('uploads/product-reviews');
        File::ensureDirectoryExists($directory);
        $urls = [];

        foreach ($validated['files'] as $file) {
            $extension = match ($file->getMimeType()) {
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => null,
            };

            if ($extension === null) {
                continue;
            }

            $filename = sprintf('%s-%s-%s.%s', $product->slug, now()->format('YmdHis'), Str::uuid()->toString(), $extension);
            $file->move($directory, $filename);
            $relativeUrl = '/uploads/product-reviews/'.$filename;
            $urls[] = rtrim((string) config('app.url'), '/').$relativeUrl;
        }

        return response()->json($this->products->transformUploadedReviewMedia($urls));
    }

    public function search(Request $request): JsonResponse
    {
        return response()->json($this->products->search($request));
    }

    public function featured(Request $request): JsonResponse
    {
        return response()->json($this->products->featured($request));
    }

    public function categoryFeed(Request $request): JsonResponse
    {
        return response()->json($this->products->categoryFeed($request));
    }

    public function categories(): JsonResponse
    {
        return response()->json(['items' => $this->products->categories()]);
    }

    public function category(string $slug): JsonResponse
    {
        return response()->json(['category' => $this->products->category($slug)]);
    }

    public function related(Product $product, Request $request): JsonResponse
    {
        return response()->json(['items' => $this->products->related($product, $request)]);
    }

    public function trackView(Product $product): JsonResponse
    {
        $this->products->trackView($product);

        return response()->json([], 204);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:products,slug'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'category' => ['required', 'string', 'max:120'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'string'],
            'gallery' => ['nullable', 'array'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
            'supplier_location' => ['nullable', 'string', 'max:255'],
            'moq' => ['nullable', 'integer', 'min:1'],
            'unit' => ['nullable', 'string', 'max:50'],
            'badge' => ['nullable', 'string', 'max:120'],
            'metadata' => ['nullable', 'array'],
        ]);
        $product = Product::create($validated);

        return response()->json(['product' => $this->products->transformProduct($product)], 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', 'unique:products,slug,'.$product->id],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'category' => ['sometimes', 'string', 'max:120'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'string'],
            'gallery' => ['nullable', 'array'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
            'supplier_location' => ['nullable', 'string', 'max:255'],
            'moq' => ['nullable', 'integer', 'min:1'],
            'unit' => ['nullable', 'string', 'max:50'],
            'badge' => ['nullable', 'string', 'max:120'],
            'metadata' => ['nullable', 'array'],
        ]);
        $product->fill($validated)->save();

        return response()->json(['product' => $this->products->transformProduct($product)]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json([], 204);
    }
}
