<?php

namespace App\Services;

use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class AliExpressPublicProductService
{
    public function fetchProductSupplement(Product $product): array
    {
        $sourceProductId = $this->resolveSourceProductId($product);
        if ($sourceProductId === null) {
            return [
                'gallery' => [],
                'sourceUrl' => null,
                'externalReviewSummary' => null,
                'externalReviews' => [],
            ];
        }

        $htmlPayload = $this->fetchPublicHtml($sourceProductId, $this->resolveSourceUrl($product));
        if ($htmlPayload === null) {
            return [
                'gallery' => [],
                'sourceUrl' => $this->resolveSourceUrl($product),
                'externalReviewSummary' => null,
                'externalReviews' => [],
            ];
        }

        $html = $htmlPayload['html'];
        $gallery = $this->extractGallery($html);
        $reviewSummary = $this->extractReviewSummary($html);
        $reviews = $this->extractReviews($html);

        if ($reviewSummary !== null) {
            $reviewSummary['displayCount'] = count($reviews);
        }

        return [
            'gallery' => $gallery,
            'sourceUrl' => $htmlPayload['sourceUrl'],
            'externalReviewSummary' => $reviewSummary,
            'externalReviews' => $reviews,
        ];
    }

    protected function resolveSourceProductId(Product $product): ?string
    {
        $sourceProductId = trim((string) ($product->source_product_id ?: ''));

        return $sourceProductId !== '' ? $sourceProductId : null;
    }

    protected function resolveSourceUrl(Product $product): ?string
    {
        $metadata = is_array($product->metadata) ? $product->metadata : [];
        $candidate = trim((string) ($metadata['sourceUrl'] ?? $metadata['source_url'] ?? ''));

        return $candidate !== '' ? $candidate : null;
    }

    protected function fetchPublicHtml(string $sourceProductId, ?string $directUrl = null): ?array
    {
        $languagePrefix = Str::lower(substr((string) env('ALIEXPRESS_DS_LOCALE', 'fr_FR'), 0, 2));
        $candidateUrls = array_values(array_unique(array_filter([
            $directUrl,
            sprintf('https://%s.aliexpress.com/item/%s.html', $languagePrefix !== '' ? $languagePrefix : 'fr', $sourceProductId),
            sprintf('https://www.aliexpress.com/item/%s.html', $sourceProductId),
        ])));

        foreach ($candidateUrls as $url) {
            $response = Http::timeout(12)
                ->withHeaders([
                    'accept-language' => str_replace('_', '-', (string) env('ALIEXPRESS_DS_LOCALE', 'fr_FR')),
                    'user-agent' => 'Mozilla/5.0 (compatible; AfriPayBot/1.0; +https://afripay.space)',
                ])
                ->get($url);

            if (! $response->ok()) {
                continue;
            }

            $html = trim((string) $response->body());
            if ($html === '' || ! str_contains($html, 'AliExpress')) {
                continue;
            }

            return [
                'html' => $html,
                'sourceUrl' => (string) $response->effectiveUri(),
            ];
        }

        return null;
    }

    protected function extractGallery(string $html): array
    {
        $jsonCandidates = $this->parseEmbeddedJsonCandidates($html);
        $nodes = array_merge(...array_map(fn ($candidate) => $this->collectObjectNodes($candidate), $jsonCandidates));
        $productRoot = collect($nodes)->first(fn ($node) => is_array($node['titleModule'] ?? null) || is_array($node['imageModule'] ?? null) || is_array($node['skuModule'] ?? null));
        $imageModule = is_array($productRoot['imageModule'] ?? null) ? $productRoot['imageModule'] : [];
        $primaryLdJson = collect($jsonCandidates)
            ->flatMap(fn ($candidate) => is_array($candidate) && $this->isAssoc($candidate) ? [$candidate] : (is_array($candidate) ? $candidate : []))
            ->first(fn ($entry) => is_array($entry) && strtolower((string) ($entry['@type'] ?? '')) === 'product');

        return $this->uniqueStrings([
            ...$this->collectStrings($imageModule['imagePathList'] ?? null),
            ...$this->collectStrings($imageModule['summImagePathList'] ?? null),
            ...$this->collectStrings($primaryLdJson['image'] ?? null),
            $this->extractHtmlMetaContent($html, 'og:image'),
            $this->extractHtmlMetaContent($html, 'twitter:image'),
        ]);
    }

    protected function extractReviewSummary(string $html): ?array
    {
        $jsonCandidates = $this->parseEmbeddedJsonCandidates($html);
        $primaryLdJson = collect($jsonCandidates)
            ->flatMap(fn ($candidate) => is_array($candidate) && $this->isAssoc($candidate) ? [$candidate] : (is_array($candidate) ? $candidate : []))
            ->first(fn ($entry) => is_array($entry) && strtolower((string) ($entry['@type'] ?? '')) === 'product');
        $aggregate = is_array($primaryLdJson['aggregateRating'] ?? null) ? $primaryLdJson['aggregateRating'] : [];

        $count = $this->toInt(
            $this->extractHtmlMetaContent($html, 'og:rating:count'),
            $aggregate['reviewCount'] ?? null,
            $aggregate['ratingCount'] ?? null,
        );
        $average = $this->toFloat($aggregate['ratingValue'] ?? null, $aggregate['rating_value'] ?? null);

        if ($count <= 0 && $average <= 0) {
            return null;
        }

        return [
            'averageRating' => $average > 0 ? round($average, 1) : null,
            'totalCount' => max(0, $count),
        ];
    }

    protected function extractReviews(string $html): array
    {
        $reviews = [];
        foreach ($this->parseEmbeddedJsonCandidates($html) as $candidate) {
            foreach ($this->collectObjectNodes($candidate) as $node) {
                $normalized = $this->normalizeReviewNode($node);
                if ($normalized === null) {
                    continue;
                }

                $key = implode('|', [
                    Str::lower($normalized['reviewerName'] ?? ''),
                    Str::lower($normalized['comment'] ?? ''),
                    $normalized['createdAt'] ?? '',
                ]);
                $reviews[$key] = $normalized;
            }
        }

        return collect(array_values($reviews))
            ->sortByDesc(fn (array $review) => (string) ($review['createdAt'] ?? ''))
            ->take(18)
            ->values()
            ->all();
    }

    protected function normalizeReviewNode(array $node): ?array
    {
        $author = $this->getString(
            $node['buyerName'] ?? null,
            $node['buyer_name'] ?? null,
            $node['reviewerName'] ?? null,
            $node['reviewer_name'] ?? null,
            $node['nickName'] ?? null,
            $node['nick_name'] ?? null,
            $node['userName'] ?? null,
            $node['user_name'] ?? null,
            is_array($node['author'] ?? null) ? ($node['author']['name'] ?? null) : ($node['author'] ?? null),
        );
        $comment = $this->getString(
            $node['comment'] ?? null,
            $node['comments'] ?? null,
            $node['content'] ?? null,
            $node['reviewContent'] ?? null,
            $node['review_content'] ?? null,
            $node['buyerFeedback'] ?? null,
            $node['buyer_feedback'] ?? null,
            $node['text'] ?? null,
            $node['body'] ?? null,
            $node['description'] ?? null,
            $node['contentText'] ?? null,
        );
        $title = $this->getString(
            $node['title'] ?? null,
            $node['summary'] ?? null,
            $node['headline'] ?? null,
        );
        $rating = $this->toInt(
            $node['rating'] ?? null,
            $node['starRating'] ?? null,
            $node['star_rating'] ?? null,
            $node['score'] ?? null,
            is_array($node['reviewRating'] ?? null) ? ($node['reviewRating']['ratingValue'] ?? null) : null,
            is_array($node['review_rating'] ?? null) ? ($node['review_rating']['rating_value'] ?? null) : null,
        );
        $mediaUrls = $this->uniqueStrings([
            ...$this->collectStrings($node['images'] ?? null),
            ...$this->collectStrings($node['imageList'] ?? null),
            ...$this->collectStrings($node['image_list'] ?? null),
            ...$this->collectStrings($node['photos'] ?? null),
            ...$this->collectStrings($node['media'] ?? null),
        ]);
        $createdAt = $this->normalizeDateString(
            $this->getString(
                $node['createdAt'] ?? null,
                $node['createTime'] ?? null,
                $node['create_time'] ?? null,
                $node['date'] ?? null,
                $node['gmtCreate'] ?? null,
                $node['publishDate'] ?? null,
                $node['publish_date'] ?? null,
            )
        );

        if (($comment === null || Str::length($comment) < 6) && $mediaUrls === []) {
            return null;
        }

        if ($author === null && $rating <= 0 && $title === null) {
            return null;
        }

        return [
            'id' => sha1(implode('|', [$author ?? '', $comment ?? '', $createdAt ?? '', implode(',', $mediaUrls)])),
            'source' => 'aliexpress',
            'reviewerName' => $author ?? 'Acheteur AliExpress',
            'rating' => max(1, min(5, $rating > 0 ? $rating : 5)),
            'title' => $title,
            'comment' => $comment ?? 'Avis AliExpress synchronisé.',
            'mediaUrls' => $mediaUrls,
            'verifiedPurchase' => true,
            'createdAt' => $createdAt,
        ];
    }

    protected function parseEmbeddedJsonCandidates(string $html): array
    {
        $parsedCandidates = [];
        $scripts = $this->extractScriptContents($html);
        $assignmentHints = [
            'window.runParams',
            'runParams',
            '__NEXT_DATA__',
            '__INITIAL_STATE__',
            '__INIT_DATA__',
            '_dida_config_._init_data_',
            '_dida_config_._init_data',
        ];

        foreach ($scripts as $script) {
            $trimmed = trim($script);
            if ($trimmed === '') {
                continue;
            }

            if ((str_starts_with($trimmed, '{') || str_starts_with($trimmed, '[')) && strlen($trimmed) > 2) {
                $decoded = json_decode($trimmed, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $parsedCandidates[] = $decoded;
                }
            }

            foreach ($assignmentHints as $hint) {
                $hintIndex = strpos($trimmed, $hint);
                if ($hintIndex === false) {
                    continue;
                }

                $assignmentIndex = strpos($trimmed, '=', $hintIndex);
                if ($assignmentIndex === false) {
                    continue;
                }

                $slice = substr($trimmed, $assignmentIndex + 1);
                if (! preg_match('/[{[]/', $slice, $matches, PREG_OFFSET_CAPTURE)) {
                    continue;
                }

                $startIndex = $assignmentIndex + 1 + (int) $matches[0][1];
                $jsonChunk = $this->extractBalancedJsonChunk($trimmed, $startIndex);
                if ($jsonChunk === null) {
                    continue;
                }

                $decoded = json_decode($jsonChunk, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $parsedCandidates[] = $decoded;
                }
            }
        }

        return $parsedCandidates;
    }

    protected function extractScriptContents(string $html): array
    {
        preg_match_all('/<script\b[^>]*>([\s\S]*?)<\/script>/i', $html, $matches);

        return array_values(array_filter(array_map(fn ($entry) => trim((string) $entry), $matches[1] ?? [])));
    }

    protected function extractBalancedJsonChunk(string $value, int $startIndex): ?string
    {
        $opening = $value[$startIndex] ?? '';
        $closing = $opening === '{' ? '}' : ($opening === '[' ? ']' : '');
        if ($closing === '') {
            return null;
        }

        $depth = 0;
        $inString = false;
        $stringQuote = '';
        $escaped = false;

        for ($index = $startIndex; $index < strlen($value); $index++) {
            $character = $value[$index];
            if ($inString) {
                if ($escaped) {
                    $escaped = false;
                    continue;
                }

                if ($character === '\\') {
                    $escaped = true;
                    continue;
                }

                if ($character === $stringQuote) {
                    $inString = false;
                    $stringQuote = '';
                }

                continue;
            }

            if ($character === '"' || $character === "'") {
                $inString = true;
                $stringQuote = $character;
                continue;
            }

            if ($character === $opening) {
                $depth++;
                continue;
            }

            if ($character === $closing) {
                $depth--;
                if ($depth === 0) {
                    return substr($value, $startIndex, $index - $startIndex + 1);
                }
            }
        }

        return null;
    }

    protected function collectObjectNodes(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $nodes = [$value];
        foreach ($value as $nested) {
            if (is_array($nested)) {
                $nodes = array_merge($nodes, $this->collectObjectNodes($nested));
            }
        }

        return $nodes;
    }

    protected function extractHtmlMetaContent(string $html, string $key): ?string
    {
        $escapedKey = preg_quote($key, '/');
        $patterns = [
            sprintf('/<meta[^>]+property=["\']%s["\'][^>]+content=["\']([^"\']+)["\'][^>]*>/i', $escapedKey),
            sprintf('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']%s["\'][^>]*>/i', $escapedKey),
            sprintf('/<meta[^>]+name=["\']%s["\'][^>]+content=["\']([^"\']+)["\'][^>]*>/i', $escapedKey),
            sprintf('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']%s["\'][^>]*>/i', $escapedKey),
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $html, $matches) === 1 && ! empty($matches[1])) {
                return trim(html_entity_decode($matches[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            }
        }

        return null;
    }

    protected function uniqueStrings(array $values): array
    {
        $normalized = [];
        foreach ($values as $value) {
            if (! is_string($value)) {
                continue;
            }

            $trimmed = trim($value);
            if ($trimmed === '') {
                continue;
            }

            if (str_starts_with($trimmed, '//')) {
                $trimmed = 'https:'.$trimmed;
            }

            $normalized[] = $trimmed;
        }

        return array_values(array_unique($normalized));
    }

    protected function collectStrings(mixed $value): array
    {
        if (is_string($value)) {
            return [$value];
        }

        if (! is_array($value)) {
            return [];
        }

        $values = [];
        foreach ($value as $entry) {
            $values = array_merge($values, $this->collectStrings($entry));
        }

        return $values;
    }

    protected function getString(mixed ...$values): ?string
    {
        foreach ($values as $value) {
            if (! is_string($value)) {
                continue;
            }

            $trimmed = trim($value);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }

        return null;
    }

    protected function toInt(mixed ...$values): int
    {
        foreach ($values as $value) {
            if (is_int($value)) {
                return $value;
            }

            if (is_numeric($value)) {
                return (int) round((float) $value);
            }
        }

        return 0;
    }

    protected function toFloat(mixed ...$values): float
    {
        foreach ($values as $value) {
            if (is_float($value) || is_int($value)) {
                return (float) $value;
            }

            if (is_string($value)) {
                $normalized = trim(str_replace(',', '.', $value));
                if ($normalized !== '' && is_numeric($normalized)) {
                    return (float) $normalized;
                }
            }
        }

        return 0.0;
    }

    protected function normalizeDateString(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->toIso8601String();
        } catch (\Throwable) {
            return trim($value);
        }
    }

    protected function isAssoc(array $value): bool
    {
        return array_keys($value) !== range(0, count($value) - 1);
    }
}