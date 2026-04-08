<?php

namespace App\Services;

use App\Models\Product;

class SearchSuggestionService
{
    protected array $defaultSuggestions = [
        'souris sans fil',
        'bureau gaming',
        'casque VR',
        'bean bag gaming',
        'piercing titane',
        'accessoires mobile',
    ];

    public function getSuggestions(string $query, int $limit = 8): array
    {
        $limit = min(max($limit, 1), 12);
        $normalizedQuery = mb_strtolower(trim($query));

        if ($normalizedQuery === '') {
            return array_slice($this->defaultSuggestions, 0, $limit);
        }

        $pool = $this->defaultSuggestions;

        try {
            $products = Product::query()->where('is_published', true)->limit(120)->get();
            foreach ($products as $product) {
                $pool[] = (string) ($product->title ?? '');
                $pool[] = (string) (($product->metadata['shortTitle'] ?? '') ?: '');
                foreach (($product->metadata['keywords'] ?? []) as $keyword) {
                    if (is_string($keyword)) {
                        $pool[] = $keyword;
                    }
                }
            }
        } catch (\Throwable) {
            // Keep default suggestions when the product storage is unavailable.
        }

        $uniqueSuggestions = array_values(array_unique(array_filter(array_map(
            fn ($value) => is_string($value) ? trim($value) : '',
            $pool
        ))));

        $ranked = collect($uniqueSuggestions)
            ->map(function (string $suggestion) use ($normalizedQuery) {
                $normalizedSuggestion = mb_strtolower($suggestion);
                if (! str_contains($normalizedSuggestion, $normalizedQuery)) {
                    return null;
                }

                $score = 0;
                if ($normalizedSuggestion === $normalizedQuery) {
                    $score += 12;
                }
                if (str_starts_with($normalizedSuggestion, $normalizedQuery)) {
                    $score += 8;
                }
                if (str_contains($normalizedSuggestion, ' '.$normalizedQuery)) {
                    $score += 5;
                }

                return [
                    'suggestion' => $suggestion,
                    'score' => $score,
                ];
            })
            ->filter()
            ->sort(fn (array $left, array $right) => $right['score'] <=> $left['score'] ?: strcmp($left['suggestion'], $right['suggestion']))
            ->take($limit)
            ->pluck('suggestion')
            ->values()
            ->all();

        return $ranked;
    }
}