<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Throwable;

class ImageSearchService
{
    public function search(Request $request): array
    {
        /** @var UploadedFile $file */
        $file = $request->file('image');
        $fileName = $file->getClientOriginalName();
        $keywords = collect(preg_split('/[^a-z0-9]+/i', Str::lower(pathinfo($fileName, PATHINFO_FILENAME)) ?: ''))
            ->filter(fn ($value) => is_string($value) && strlen($value) >= 3)
            ->values();

        $query = Product::query()->where('is_published', true);
        if ($keywords->isNotEmpty()) {
            $query->where(function ($nested) use ($keywords) {
                foreach ($keywords as $keyword) {
                    $like = '%'.$keyword.'%';
                    $nested->orWhere('title', 'like', $like)
                        ->orWhere('slug', 'like', $like)
                        ->orWhere('category', 'like', $like);
                }
            });
        }

        try {
            $products = $query->orderByDesc('views_count')->limit(6)->get();
            if ($products->isEmpty()) {
                $products = Product::query()->where('is_published', true)->orderByDesc('views_count')->limit(6)->get();
            }
        } catch (Throwable) {
            $products = collect($this->fallbackSlugs())->map(function (string $slug) {
                return new Product([
                    'slug' => $slug,
                    'title' => str_replace('-', ' ', $slug),
                    'is_published' => true,
                ]);
            });
        }

        return [
            'fileName' => $fileName,
            'results' => $products->values()->map(function (Product $product, int $index) {
                return [
                    'slug' => $product->slug,
                    'score' => max(0.1, round(1 - ($index * 0.08), 3)),
                ];
            })->all(),
        ];
    }

    protected function fallbackSlugs(): array
    {
        $path = base_path('data/site/free-deal-config.json');
        if (! File::exists($path)) {
            return [];
        }

        $decoded = json_decode((string) File::get($path), true);

        return is_array($decoded['productSlugs'] ?? null)
            ? array_slice(array_values(array_filter($decoded['productSlugs'], 'is_string')), 0, 6)
            : [];
    }
}