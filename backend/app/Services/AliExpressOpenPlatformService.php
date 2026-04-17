<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class AliExpressOpenPlatformService
{
    private const ALIBABA_AUTHORIZE_URL = 'https://openapi-auth.alibaba.com/oauth/authorize';
    private const ALIBABA_TOKEN_URL = 'https://openapi-api.alibaba.com/rest/auth/token/create';
    private const ALIBABA_REFRESH_URL = 'https://openapi-api.alibaba.com/rest/auth/token/refresh';
    private const ALIBABA_API_BASE_URL = 'https://openapi-api.alibaba.com';

    public function makeEnvironmentAccount(): ?array
    {
        $appKey = trim((string) env('ALIBABA_APP_KEY', env('ALIEXPRESS_APP_KEY', '')));
        $appSecret = trim((string) env('ALIBABA_APP_SECRET', env('ALIEXPRESS_APP_SECRET', '')));
        $accessToken = trim((string) env('ALIBABA_ACCESS_TOKEN', env('ALIEXPRESS_ACCESS_TOKEN', '')));

        if ($appKey === '' || $appSecret === '' || $accessToken === '') {
            return null;
        }

        $timestamp = now()->toIso8601String();

        return [
            'id' => 'env-alibaba',
            'name' => 'Alibaba Environment',
            'email' => 'env@alibaba.local',
            'accountPlatform' => 'seller',
            'countryCode' => strtoupper(trim((string) env('ALIEXPRESS_DS_SHIP_TO_COUNTRY', 'FR')) ?: 'FR'),
            'defaultDispatchLocation' => 'CN',
            'status' => 'connected',
            'appKey' => $appKey,
            'appSecret' => $appSecret,
            'authorizeUrl' => trim((string) env('ALIBABA_AUTHORIZE_URL', self::ALIBABA_AUTHORIZE_URL)) ?: self::ALIBABA_AUTHORIZE_URL,
            'tokenUrl' => trim((string) env('ALIBABA_TOKEN_URL', self::ALIBABA_TOKEN_URL)) ?: self::ALIBABA_TOKEN_URL,
            'refreshUrl' => trim((string) env('ALIBABA_REFRESH_URL', self::ALIBABA_REFRESH_URL)) ?: self::ALIBABA_REFRESH_URL,
            'apiBaseUrl' => trim((string) env('ALIBABA_BASE_URL', env('ALIEXPRESS_BASE_URL', self::ALIBABA_API_BASE_URL))) ?: self::ALIBABA_API_BASE_URL,
            'accessToken' => $accessToken,
            'refreshToken' => null,
            'isActive' => true,
            'createdAt' => $timestamp,
            'updatedAt' => $timestamp,
        ];
    }

    public function buildAuthorizationUrl(array $account, string $callbackUrl, string $targetRedirectUrl): string
    {
        $appKey = trim((string) ($account['appKey'] ?? ''));
        if ($appKey === '') {
            throw new RuntimeException("Ajoute l'App Key avant de lancer l'autorisation OAuth.");
        }

        $authorizeUrl = trim((string) ($account['authorizeUrl'] ?? self::ALIBABA_AUTHORIZE_URL));
        $query = [
            'response_type' => 'code',
            'client_id' => $appKey,
            'redirect_uri' => $callbackUrl,
            'state' => $this->encodeOAuthState((string) ($account['id'] ?? ''), $targetRedirectUrl),
            'force_auth' => 'true',
        ];

        $parts = parse_url($authorizeUrl);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? 'openapi-auth.alibaba.com';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = $parts['path'] ?? '/oauth/authorize';

        return $scheme.'://'.$host.$port.$path.'?'.http_build_query($query);
    }

    public function exchangeOAuthCode(array $account, string $code): array
    {
        $normalizedCode = trim($code);
        if ($normalizedCode === '') {
            throw new RuntimeException('Code OAuth Open Platform manquant.');
        }

        $tokenUrl = trim((string) ($account['tokenUrl'] ?? self::ALIBABA_TOKEN_URL));
        $result = null;

        foreach ($this->getOAuthEndpointCandidates($tokenUrl, 'token') as $candidateUrl) {
            $payload = ['code' => $normalizedCode];
            if ($this->usesSecurityTokenEndpoint($candidateUrl, 'token')) {
                $payload['uuid'] = (string) Str::uuid();
            }

            $result = $this->callRestEndpoint($account, $candidateUrl, $payload, false);
            if ($result['ok'] && $this->isOAuthTokenResponseSuccessful($result['responseBody'])) {
                break;
            }

            if (! $this->shouldTryOAuthAlternateEndpoint($result['responseBody'])) {
                break;
            }
        }

        if (! is_array($result) || ! $result['ok'] || ! $this->isOAuthTokenResponseSuccessful($result['responseBody'])) {
            throw new RuntimeException($this->getOAuthResponseMessage($result['responseBody'] ?? null) ?? "Generation du token d'acces Open Platform impossible.");
        }

        return [
            'account' => $this->mergeOAuthAccountData($account, $this->getOAuthResponseBody($result['responseBody']) ?? []),
            'responseBody' => $result['responseBody'],
        ];
    }

    public function refreshTokens(array $account): array
    {
        $refreshToken = trim((string) ($account['refreshToken'] ?? ''));
        if ($refreshToken === '') {
            throw new RuntimeException('Aucun refresh token Alibaba disponible.');
        }

        $refreshUrl = trim((string) ($account['refreshUrl'] ?? self::ALIBABA_REFRESH_URL));
        $result = null;

        foreach ($this->getOAuthEndpointCandidates($refreshUrl, 'refresh') as $candidateUrl) {
            $result = $this->callRestEndpoint($account, $candidateUrl, [
                'refresh_token' => $refreshToken,
            ], false);

            if ($result['ok'] && $this->isOAuthTokenResponseSuccessful($result['responseBody'])) {
                break;
            }

            if (! $this->shouldTryOAuthAlternateEndpoint($result['responseBody'])) {
                break;
            }
        }

        if (! is_array($result) || ! $result['ok'] || ! $this->isOAuthTokenResponseSuccessful($result['responseBody'])) {
            throw new RuntimeException($this->getOAuthResponseMessage($result['responseBody'] ?? null) ?? 'Refresh du token AliExpress impossible.');
        }

        return [
            'account' => $this->mergeOAuthAccountData($account, $this->getOAuthResponseBody($result['responseBody']) ?? []),
            'responseBody' => $result['responseBody'],
        ];
    }

    public function search(array $account, array $input): array
    {
        if (($input['provider'] ?? null) === 'alibaba') {
            return $this->searchAlibabaBuyerProducts($account, $input);
        }

        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $query = trim((string) ($input['query'] ?? ''));
        if ($query === '') {
            throw new RuntimeException('Requete de recherche AliExpress manquante.');
        }

        $local = trim((string) ($input['local'] ?? env('ALIEXPRESS_DS_LOCALE', 'fr_FR')));
        $countryCode = strtoupper(trim((string) ($input['countryCode'] ?? env('ALIEXPRESS_DS_SHIP_TO_COUNTRY', 'FR'))));
        $currency = strtoupper(trim((string) ($input['currency'] ?? 'USD')));
        $pageSize = max(1, min(100, (int) ($input['pageSize'] ?? 12)));
        $pageIndex = max(1, (int) ($input['pageIndex'] ?? 1));
        $requestBody = [
            'keyWord' => $query,
            'local' => $local,
            'countryCode' => $countryCode,
            'sortBy' => $this->normalizeSortBy($input['sortBy'] ?? null),
            'pageSize' => $pageSize,
            'pageIndex' => $pageIndex,
            'currency' => $currency,
        ];

        $categoryId = (int) ($input['categoryId'] ?? 0);
        if ($categoryId > 0) {
            $requestBody['categoryId'] = $categoryId;
        }

        $selectionName = trim((string) ($input['selectionName'] ?? ''));
        if ($selectionName !== '') {
            $requestBody['selectionName'] = $selectionName;
        }

        $searchExtend = $this->normalizeSearchExtend($input['searchExtend'] ?? null);
        if ($searchExtend !== null) {
            $requestBody['searchExtend'] = $searchExtend;
        }

        $searchResult = $this->callTopEndpoint($account, 'aliexpress.ds.text.search', $requestBody);
        $requestId = $this->getString($searchResult['responseBody']['request_id'] ?? null);
        if (! $searchResult['ok']) {
            $error = $this->extractTradeError($searchResult['responseBody']);
            return [
                'account' => $account,
                'payload' => [
                    'products' => [],
                    'totalCount' => 0,
                    'pageIndex' => $pageIndex,
                    'pageSize' => $pageSize,
                    'requestId' => $requestId,
                    'message' => $error['subMessage'] ?? $error['message'] ?? 'Recherche AliExpress DS impossible.',
                    'debug' => $searchResult['responseBody'],
                ],
            ];
        }

        $payload = $this->getSellerPayload($searchResult['responseBody']);
        $payloadData = $this->isAssoc($payload['data'] ?? null) ? $payload['data'] : $payload;
        $searchItems = $this->extractSearchItems($payload);
        $products = [];

        foreach ($searchItems as $searchItem) {
            $productId = $this->getString($searchItem['itemId'] ?? $searchItem['item_id'] ?? $searchItem['product_id'] ?? $searchItem['productId'] ?? null);
            if ($productId === null) {
                continue;
            }

            try {
                $detailResult = $this->callTopEndpoint($account, 'aliexpress.ds.product.get', [
                    'ship_to_country' => $countryCode,
                    'product_id' => $productId,
                    'target_currency' => $currency,
                    'target_language' => $local,
                    'remove_personal_benefit' => 'false',
                ]);

                $previewItem = $this->buildSearchPreviewItem($searchItem, $query, $countryCode, $detailResult['responseBody'], $detailResult['ok']);
            } catch (\Throwable $exception) {
                $previewItem = $this->buildSearchPreviewItem($searchItem, $query, $countryCode, [], false);

                if ($previewItem !== null && ($previewItem['importable'] ?? false) === false) {
                    $previewItem['importReason'] = $exception->getMessage() !== ''
                        ? $exception->getMessage()
                        : "Le detail live AliExpress n'a pas pu etre reconstruit pour cet article.";
                }
            }

            if ($previewItem !== null) {
                $products[] = $previewItem;
            }
        }

        return [
            'account' => $account,
            'payload' => [
                'products' => $products,
                'totalCount' => $this->toInt($payloadData['totalCount'] ?? $payloadData['total_count'] ?? count($products)),
                'pageIndex' => $this->toInt($payloadData['pageIndex'] ?? $payloadData['page_index'] ?? $pageIndex),
                'pageSize' => $this->toInt($payloadData['pageSize'] ?? $payloadData['page_size'] ?? $pageSize),
                'requestId' => $requestId,
            ],
        ];
    }

    public function fetchRemote(array $account, array $input): array
    {
        if (($input['provider'] ?? null) === 'alibaba') {
            return $this->fetchAlibabaBuyerProduct($account, $input);
        }

        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $identifier = trim((string) ($input['query'] ?? ''));
        $sourceProductId = $this->extractSourceProductId($identifier);
        if ($sourceProductId === '') {
            throw new RuntimeException("Import manuel impossible: saisis un External product ID AliExpress ou un lien produit AliExpress.");
        }

        $countryCode = strtoupper(trim((string) ($input['destinationCountry'] ?? env('ALIEXPRESS_DS_SHIP_TO_COUNTRY', 'FR'))));
        $currency = strtoupper(trim((string) ($input['targetCurrency'] ?? 'USD')));
        $language = trim((string) ($input['targetLanguage'] ?? env('ALIEXPRESS_DS_LOCALE', 'fr_FR')));

        $detailResult = $this->callTopEndpoint($account, 'aliexpress.ds.product.get', [
            'ship_to_country' => $countryCode,
            'product_id' => $sourceProductId,
            'target_currency' => $currency,
            'target_language' => $language,
            'remove_personal_benefit' => 'false',
        ]);

        $debug = [
            'externalProductId' => $sourceProductId,
            'shipToCountry' => $countryCode,
            'targetCurrency' => $currency,
            'targetLanguage' => $language,
            'resolvedRemoteMode' => $detailResult['ok'] ? 'ds_product' : null,
            'fallbackUsed' => false,
            'providerErrorCode' => $this->extractOperationCode($detailResult['responseBody']),
            'providerMessage' => $this->extractOperationMessage($detailResult['responseBody']),
            'responseShape' => $this->describeExactProductResponseShape($detailResult['responseBody']),
            'attempts' => [[
                'endpoint' => 'aliexpress.ds.product.get',
                'shipToCountry' => $countryCode,
                'targetCurrency' => $currency,
                'targetLanguage' => $language,
                'ok' => $detailResult['ok'],
                'status' => $detailResult['status'],
                'providerErrorCode' => $this->extractOperationCode($detailResult['responseBody']),
                'providerMessage' => $this->extractOperationMessage($detailResult['responseBody']),
                'responseShape' => $this->describeExactProductResponseShape($detailResult['responseBody']),
                'mappingStatus' => $detailResult['ok'] ? 'mapped' : 'provider_error',
            ]],
        ];

        $product = $detailResult['ok']
            ? $this->mapDetailProduct(['itemId' => $sourceProductId, 'product_id' => $sourceProductId], $detailResult['responseBody'], $identifier)
            : null;

        if ($product === null) {
            throw new RuntimeException($this->extractOperationMessage($detailResult['responseBody']) ?? 'Produit AliExpress introuvable via ds.product.get.');
        }

        return [
            'account' => $account,
            'payload' => [
                'ok' => true,
                'endpoint' => 'aliexpress.ds.product.get',
                'sourceProductId' => $sourceProductId,
                'product' => $product,
                'debug' => $debug,
            ],
        ];
    }

    private function searchAlibabaBuyerProducts(array $account, array $input): array
    {
        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $query = trim((string) ($input['query'] ?? ''));
        if ($query === '') {
            throw new RuntimeException('Requete de recherche Alibaba manquante.');
        }

        $pageSize = max(1, min(20, (int) ($input['pageSize'] ?? 12)));
        $pageIndex = max(1, (int) ($input['pageIndex'] ?? 1));
        $request = [
            'keyword' => $query,
            'query' => $query,
            'page_index' => $pageIndex,
            'page_size' => $pageSize,
            'destination_country' => strtoupper(trim((string) ($input['countryCode'] ?? env('ALIBABA_SHIP_TO_COUNTRY', 'FR')))),
        ];

        $searchResult = $this->callRestEndpoint($account, '/eco/buyer/product/search', [
            'param0' => $request,
        ]);
        $items = $this->extractAlibabaBuyerProductItems($searchResult['responseBody']);
        $products = array_values(array_filter(array_map(
            fn ($item) => $this->mapAlibabaBuyerSearchItem($item, $query),
            $items
        )));

        return [
            'account' => $account,
            'payload' => [
                'products' => $products,
                'totalCount' => $this->extractAlibabaPaginationTotal($searchResult['responseBody']) ?? count($products),
                'pageIndex' => $pageIndex,
                'pageSize' => $pageSize,
                'requestId' => $this->getString($searchResult['responseBody']['request_id'] ?? null),
            ],
        ];
    }

    private function fetchAlibabaBuyerProduct(array $account, array $input): array
    {
        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $identifier = trim((string) ($input['query'] ?? ''));
        $sourceProductId = $this->extractSourceProductId($identifier);
        if ($sourceProductId === '') {
            throw new RuntimeException('Import manuel impossible: saisis un product_id Alibaba ou un lien produit Alibaba.');
        }

        $result = $this->callRestEndpoint($account, '/eco/buyer/product/description', [
            'query_req' => [
                'product_id' => $sourceProductId,
                'destination_country' => strtoupper(trim((string) ($input['destinationCountry'] ?? env('ALIBABA_SHIP_TO_COUNTRY', 'FR')))),
            ],
        ]);
        $product = $this->mapAlibabaBuyerDescriptionToProduct($result['responseBody'], $identifier);

        if ($product === null) {
            throw new RuntimeException($this->extractOperationMessage($result['responseBody']) ?? 'Produit Alibaba introuvable via eco/buyer/product/description.');
        }

        return [
            'account' => $account,
            'payload' => [
                'ok' => true,
                'endpoint' => '/eco/buyer/product/description',
                'sourceProductId' => $product['sourceProductId'],
                'product' => $product,
                'debug' => [
                    'externalProductId' => $product['sourceProductId'],
                    'resolvedRemoteMode' => 'alibaba_buyer_product_description',
                    'fallbackUsed' => false,
                    'providerRequestId' => $this->getString($result['responseBody']['request_id'] ?? null),
                    'responseShape' => 'buyer_product_description',
                    'attempts' => [[
                        'endpoint' => '/eco/buyer/product/description',
                        'ok' => $result['ok'],
                        'status' => $result['status'],
                        'responseShape' => 'buyer_product_description',
                        'mappingStatus' => 'mapped',
                    ]],
                ],
            ],
        ];
    }

    private function extractAlibabaBuyerProductItems($responseBody): array
    {
        $body = $this->toArray($responseBody);
        $candidates = [
            $body['result']['data']['products'] ?? null,
            $body['result']['result_data']['products'] ?? null,
            $body['result']['result_data']['items'] ?? null,
            $body['result_data']['products'] ?? null,
            $body['result_data']['items'] ?? null,
            $body['products'] ?? null,
            $body['items'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_array($candidate)) {
                return array_values(array_filter($candidate, fn ($item) => is_array($item)));
            }
        }

        return [];
    }

    private function extractAlibabaPaginationTotal($responseBody): ?int
    {
        $body = $this->toArray($responseBody);
        $candidates = [
            $body['result']['data']['pagination']['total_product_count'] ?? null,
            $body['result']['result_data']['pagination']['total_product_count'] ?? null,
            $body['result']['result_total'] ?? null,
            $body['result_total'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if ($candidate !== null && is_numeric($candidate)) {
                return (int) $candidate;
            }
        }

        return null;
    }

    private function mapAlibabaBuyerSearchItem(array $item, string $query): ?array
    {
        $sourceProductId = $this->getString($item['product_id'] ?? $item['productId'] ?? $item['item_id'] ?? $item['itemId'] ?? null);
        if ($sourceProductId === null) {
            return null;
        }

        $image = $this->extractAlibabaBuyerImage($item);
        $title = $this->getString($item['title'] ?? null) ?? 'Produit Alibaba '.$sourceProductId;
        $price = $this->toFloat($item['price'] ?? $item['original_price'] ?? 0);
        $product = [
            'sourceProductId' => $sourceProductId,
            'slug' => $this->slugify($title.'-'.$sourceProductId),
            'title' => $title,
            'shortTitle' => Str::limit($title, 88, ''),
            'description' => $title,
            'query' => $query,
            'keywords' => array_values(array_filter([$query])),
            'image' => $image,
            'gallery' => array_values(array_unique(array_filter([$image]))),
            'packaging' => 'Selon fournisseur Alibaba',
            'itemWeightGrams' => 0,
            'lotCbm' => '0',
            'minUsd' => $price,
            'maxUsd' => null,
            'moq' => 1,
            'unit' => 'Piece',
            'supplierName' => 'Alibaba Supplier',
            'supplierLocation' => 'Alibaba.com',
            'responseTime' => '24h',
            'yearsInBusiness' => 1,
            'transactionsLabel' => 'Alibaba.com',
            'soldLabel' => $this->getString($item['sold_quantity'] ?? null) ? ((string) $item['sold_quantity']).' vendu(s)' : 'Catalogue Alibaba',
            'customizationLabel' => 'Selon fournisseur',
            'shippingLabel' => 'Fret Alibaba a calculer',
            'overview' => ['Produit trouve via Alibaba Buyer Sourcing API.'],
            'variantGroups' => [],
            'variantPricing' => [],
            'variantSkus' => [],
            'tiers' => [],
            'specs' => [],
            'inventory' => $this->toInt($item['available_quantity'] ?? 0),
            'rawPayload' => [
                'provider' => 'alibaba',
                'searchItem' => $item,
            ],
        ];

        return [
            'productId' => $sourceProductId,
            'title' => $title,
            'itemUrl' => $this->getString($item['permalink'] ?? $item['detail_url'] ?? null),
            'imageUrl' => $image,
            'salePrice' => $price > 0 ? (string) $price : null,
            'salePriceCurrency' => $this->getString($item['currency'] ?? null) ?? 'USD',
            'categoryId' => $this->getString($item['category_id'] ?? $item['isv_category_id'] ?? null),
            'importable' => true,
            'importSource' => 'search_fallback',
            'product' => $product,
        ];
    }

    private function mapAlibabaBuyerDescriptionToProduct($responseBody, string $query): ?array
    {
        $body = $this->toArray($responseBody);
        $record = $body['result']['result_data'] ?? $body['result_data'] ?? $body['data'] ?? null;
        if (! is_array($record)) {
            return null;
        }

        $sourceProductId = $this->getString($record['product_id'] ?? null);
        if ($sourceProductId === null) {
            return null;
        }

        $title = $this->getString($record['title'] ?? null) ?? 'Produit Alibaba '.$sourceProductId;
        $skus = is_array($record['skus'] ?? null) ? $record['skus'] : [];
        $firstSku = is_array($skus[0] ?? null) ? $skus[0] : [];
        $price = $this->extractAlibabaBuyerDescriptionPrice($record, $firstSku);
        $image = $this->getString($record['main_image'] ?? null) ?? $this->extractAlibabaBuyerImage($firstSku);
        $gallery = array_values(array_unique(array_filter([
            $image,
            ...(is_array($record['images'] ?? null) ? array_filter(array_map(fn ($item) => $this->getString($item), $record['images'])) : []),
        ])));

        return [
            'sourceProductId' => $sourceProductId,
            'categorySlug' => $this->getString($record['category_id'] ?? null),
            'categoryTitle' => $this->getString($record['category'] ?? null),
            'slug' => $this->slugify($title.'-'.$sourceProductId),
            'title' => $title,
            'shortTitle' => Str::limit($title, 88, ''),
            'description' => $this->getString($record['description'] ?? null) ?? $title,
            'query' => $query,
            'keywords' => array_values(array_filter([$this->getString($record['category'] ?? null), $query])),
            'image' => $image ?? '/globe.svg',
            'gallery' => $gallery,
            'videoUrl' => $this->getString($record['video_url'] ?? null),
            'packaging' => $this->getString($record['wholesale_trade']['package_size'] ?? null) ?? 'Selon fournisseur Alibaba',
            'itemWeightGrams' => (int) round($this->toFloat($record['wholesale_trade']['weight'] ?? 0) * 1000),
            'lotCbm' => '0',
            'minUsd' => $price,
            'maxUsd' => null,
            'moq' => max(1, $this->toInt($record['min_order_quantity'] ?? $record['wholesale_trade']['min_order_quantity'] ?? 1)),
            'unit' => $this->getString($firstSku['unit'] ?? $record['wholesale_trade']['unit_type'] ?? null) ?? 'Piece',
            'supplierName' => $this->getString($record['supplier'] ?? null) ?? 'Alibaba Supplier',
            'supplierLocation' => 'Alibaba.com',
            'supplierCompanyId' => $this->getString($record['eCompanyId'] ?? null),
            'responseTime' => '24h',
            'yearsInBusiness' => 1,
            'transactionsLabel' => 'Alibaba.com',
            'soldLabel' => 'Catalogue Alibaba',
            'customizationLabel' => 'Selon fournisseur',
            'shippingLabel' => 'Fret Alibaba a calculer',
            'overview' => ['Produit charge via Get Product Description Alibaba.'],
            'variantGroups' => [],
            'variantPricing' => [],
            'variantSkus' => array_values(array_filter(array_map(fn ($sku) => is_array($sku) ? [
                'skuId' => $this->getString($sku['sku_id'] ?? null),
                'label' => collect($sku['sku_attr_list'] ?? [])->map(fn ($attr) => is_array($attr) ? trim(($attr['attr_name_desc'] ?? '').': '.($attr['attr_value_desc'] ?? '')) : '')->filter()->implode(' / '),
            ] : null, $skus))),
            'tiers' => [],
            'specs' => [],
            'inventory' => $this->toInt($firstSku['inventory_count'] ?? 0),
            'rawPayload' => [
                'provider' => 'alibaba',
                'description' => $record,
                'response' => $body,
            ],
        ];
    }

    private function extractAlibabaBuyerImage(array $item): ?string
    {
        if (is_array($item['image'] ?? null)) {
            return $this->getString($item['image']['main_image'] ?? null)
                ?? (is_array($item['image']['multi_image'] ?? null) ? $this->getString($item['image']['multi_image'][0] ?? null) : null);
        }

        return $this->getString($item['main_image_url'] ?? $item['image'] ?? null)
            ?? (is_array($item['image_urls'] ?? null) ? $this->getString($item['image_urls'][0] ?? null) : null);
    }

    private function extractAlibabaBuyerDescriptionPrice(array $record, array $firstSku): float
    {
        $ladder = is_array($firstSku['ladder_price'] ?? null) ? $firstSku['ladder_price'] : [];
        $firstLadder = is_array($ladder[0] ?? null) ? $ladder[0] : [];

        return $this->toFloat($firstLadder['price'] ?? $record['price'] ?? $record['wholesale_trade']['price'] ?? 0);
    }

    public function probeDsApi(array $account, array $input): array
    {
        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $operation = $this->normalizeDsOperation($input['operation'] ?? $input['apiName'] ?? null);

        if ($operation === null) {
            throw new RuntimeException('Operation AliExpress DS manquante.');
        }

        $result = match ($operation) {
            'aliexpress.ds.feedname.get' => $this->callTopEndpoint($account, $operation, array_filter([
                'app_signature' => $this->getString($input['appSignature'] ?? $input['app_signature'] ?? null),
            ], fn ($value) => $value !== null && $value !== '')),
            'aliexpress.ds.feed.itemids.get' => $this->callTopEndpoint($account, $operation, array_filter([
                'page_size' => (string) max(1, min(200, (int) ($input['pageSize'] ?? $input['page_size'] ?? 50))),
                'feed_name' => $this->requireProbeString($input, ['feedName', 'feed_name'], 'feed_name'),
                'search_id' => $this->getString($input['searchId'] ?? $input['search_id'] ?? null),
            ], fn ($value) => $value !== null && $value !== '')),
            'aliexpress.ds.product.get' => $this->callTopEndpoint($account, $operation, [
                'ship_to_country' => strtoupper($this->requireProbeString($input, ['shipToCountry', 'ship_to_country'], 'ship_to_country', (string) env('ALIEXPRESS_DS_SHIP_TO_COUNTRY', 'FR'))),
                'product_id' => $this->requireProbeString($input, ['productId', 'product_id'], 'product_id'),
                'target_currency' => strtoupper($this->stringOrDefault($input['targetCurrency'] ?? $input['target_currency'] ?? null, 'USD')),
                'target_language' => $this->stringOrDefault($input['targetLanguage'] ?? $input['target_language'] ?? null, (string) env('ALIEXPRESS_DS_LOCALE', 'fr_FR')),
                'remove_personal_benefit' => $this->normalizeProbeBoolean($input['removePersonalBenefit'] ?? $input['remove_personal_benefit'] ?? false),
            ]),
            'aliexpress.ds.freight.query' => $this->queryDsFreight($account, array_filter([
                'quantity' => (string) max(1, (int) ($input['quantity'] ?? 1)),
                'shipToCountry' => strtoupper($this->requireProbeString($input, ['shipToCountry', 'ship_to_country'], 'ship_to_country', (string) env('ALIEXPRESS_DS_SHIP_TO_COUNTRY', 'FR'))),
                'productId' => $this->requireProbeString($input, ['productId', 'product_id'], 'product_id'),
                'provinceCode' => $this->getString($input['provinceCode'] ?? $input['province_code'] ?? null),
                'cityCode' => $this->getString($input['cityCode'] ?? $input['city_code'] ?? null),
                'language' => $this->stringOrDefault($input['language'] ?? null, (string) env('ALIEXPRESS_DS_LOCALE', 'fr_FR')),
                'locale' => $this->stringOrDefault($input['locale'] ?? null, (string) env('ALIEXPRESS_DS_LOCALE', 'fr_FR')),
                'currency' => strtoupper($this->stringOrDefault($input['currency'] ?? null, 'USD')),
                'selectedSkuId' => $this->requireProbeString($input, ['selectedSkuId', 'selected_sku_id'], 'selectedSkuId'),
            ], fn ($value) => $value !== null && $value !== '')),
            'aliexpress.ds.address.get' => $this->callTopEndpoint($account, $operation, [
                'countryCode' => strtoupper($this->requireProbeString($input, ['countryCode', 'country_code'], 'countryCode')),
                'language' => $this->stringOrDefault($input['language'] ?? null, (string) env('ALIEXPRESS_DS_LOCALE', 'fr_FR')),
                'isMultiLanguage' => $this->normalizeProbeBoolean($input['isMultiLanguage'] ?? $input['is_multi_language'] ?? true),
            ]),
            'aliexpress.ds.order.tracking.get' => $this->callTopEndpoint($account, $operation, [
                'ae_order_id' => $this->requireProbeString($input, ['aeOrderId', 'ae_order_id'], 'ae_order_id'),
                'language' => $this->stringOrDefault($input['language'] ?? null, (string) env('ALIEXPRESS_DS_LOCALE', 'fr_FR')),
            ]),
            'aliexpress.trade.ds.order.get' => $this->callTopEndpoint($account, $operation, [
                'single_order_query' => json_encode([
                    'order_id' => $this->requireProbeString($input, ['orderId', 'order_id'], 'order_id'),
                ], JSON_UNESCAPED_SLASHES),
            ]),
            'aliexpress.ds.image.searchv2' => $this->callTopEndpoint($account, 'aliexpress.ds.image.searchV2', [
                'param0' => json_encode(array_filter([
                    'search_type' => $this->getString($input['searchType'] ?? $input['search_type'] ?? null),
                    'image_base64' => $this->requireProbeString($input, ['imageBase64', 'image_base64'], 'image_base64'),
                    'currency' => strtoupper($this->stringOrDefault($input['currency'] ?? null, 'USD')),
                    'lang' => $this->stringOrDefault($input['lang'] ?? $input['language'] ?? null, 'en'),
                    'sort_type' => $this->getString($input['sortType'] ?? $input['sort_type'] ?? null),
                    'sort_order' => $this->getString($input['sortOrder'] ?? $input['sort_order'] ?? null),
                    'ship_to' => strtoupper($this->stringOrDefault($input['shipTo'] ?? $input['ship_to'] ?? null, (string) env('ALIEXPRESS_DS_SHIP_TO_COUNTRY', 'FR'))),
                ], fn ($value) => $value !== null && $value !== ''), JSON_UNESCAPED_SLASHES),
            ]),
            'aliexpress.ds.text.search' => $this->callTopEndpoint($account, $operation, array_filter([
                'keyWord' => $this->requireProbeString($input, ['query', 'keyWord', 'keyword'], 'keyWord'),
                'local' => $this->stringOrDefault($input['local'] ?? null, (string) env('ALIEXPRESS_DS_LOCALE', 'fr_FR')),
                'countryCode' => strtoupper($this->stringOrDefault($input['countryCode'] ?? $input['country_code'] ?? null, (string) env('ALIEXPRESS_DS_SHIP_TO_COUNTRY', 'FR'))),
                'categoryId' => ($categoryId = (int) ($input['categoryId'] ?? $input['category_id'] ?? 0)) > 0 ? (string) $categoryId : null,
                'sortBy' => $this->normalizeSortBy($input['sortBy'] ?? null),
                'pageSize' => (string) max(1, min(50, (int) ($input['pageSize'] ?? $input['page_size'] ?? 20))),
                'pageIndex' => (string) max(1, (int) ($input['pageIndex'] ?? $input['page_index'] ?? 1)),
                'currency' => strtoupper($this->stringOrDefault($input['currency'] ?? null, 'USD')),
                'searchExtend' => $this->normalizeSearchExtend($input['searchExtend'] ?? $input['search_extend'] ?? null),
                'selectionName' => $this->getString($input['selectionName'] ?? $input['selection_name'] ?? null),
            ], fn ($value) => $value !== null && $value !== '')),
            default => throw new RuntimeException("Operation AliExpress DS non supportee: {$operation}"),
        };

        return [
            'account' => $account,
            'result' => $result,
        ];
    }

    public function prepareDraftOrder(array $account, array $product, array $address, int $quantity): array
    {
        if (($account['provider'] ?? null) === 'alibaba' || ($product['rawPayload']['provider'] ?? null) === 'alibaba') {
            return $this->prepareAlibabaDraftOrder($account, $product, $address, $quantity);
        }

        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $countryCode = strtoupper(trim((string) ($address['countryCode'] ?? env('ALIEXPRESS_DS_SHIP_TO_COUNTRY', 'FR'))));
        $currency = 'USD';
        $language = trim((string) env('ALIEXPRESS_DS_LOCALE', 'fr_FR')) ?: 'fr_FR';
        $validatedAddress = $this->resolveValidatedAddress($account, $address, $language);
        $liveDetail = $this->callTopEndpoint($account, 'aliexpress.ds.product.get', [
            'ship_to_country' => $countryCode,
            'product_id' => (string) ($product['sourceProductId'] ?? ''),
            'target_currency' => $currency,
            'target_language' => $language,
            'remove_personal_benefit' => 'false',
        ]);

        if (! $liveDetail['ok']) {
            throw new RuntimeException($this->extractOperationMessage($liveDetail['responseBody']) ?? 'Lecture du produit AliExpress impossible avant commande DS.');
        }

        $liveRawPayload = [
            'detail' => $this->getSellerPayload($liveDetail['responseBody']),
            'response' => $liveDetail['responseBody'],
            'existing' => $product['rawPayload'] ?? null,
        ];
        $liveProduct = $this->mapDetailProduct(['itemId' => (string) ($product['sourceProductId'] ?? ''), 'product_id' => (string) ($product['sourceProductId'] ?? '')], $liveDetail['responseBody'], (string) ($product['title'] ?? $product['sourceProductId'] ?? ''));
        if ($liveProduct === null) {
            $liveProduct = $product;
            $liveProduct['rawPayload'] = $liveRawPayload;
        }

        $skuId = $this->extractSkuId($liveRawPayload)
            ?? $this->extractSkuId($liveProduct['rawPayload'] ?? null)
            ?? $this->extractSkuIdFromVariantSkus($liveProduct['variantSkus'] ?? null);
        if ($skuId === null) {
            throw new RuntimeException('SKU AliExpress introuvable pour cet article. Reimporte le produit puis relance le lot DS.');
        }

        $skuAttr = $this->extractSkuAttr($liveRawPayload, $skuId)
            ?? $this->extractSkuAttr($liveProduct['rawPayload'] ?? null, $skuId)
            ?? '';
        $freightResult = $this->queryDsFreight($account, [
            'quantity' => (string) $quantity,
            'shipToCountry' => $countryCode,
            'productId' => (string) ($product['sourceProductId'] ?? ''),
            'selectedSkuId' => $skuId,
            'provinceCode' => $validatedAddress['stateCode'],
            'cityCode' => $validatedAddress['cityCode'],
            'language' => $language,
            'currency' => 'USD',
            'locale' => $language,
        ]);

        $carrierCode = $this->resolveCarrierCode($freightResult['responseBody']);
        if ($carrierCode === null && ($validatedAddress['stateCode'] !== '' || $validatedAddress['cityCode'] !== '')) {
            $fallbackFreightResult = $this->queryDsFreight($account, [
                'quantity' => (string) $quantity,
                'shipToCountry' => $countryCode,
                'productId' => (string) ($product['sourceProductId'] ?? ''),
                'selectedSkuId' => $skuId,
                'language' => $language,
                'currency' => 'USD',
                'locale' => $language,
            ]);

            $fallbackCarrierCode = $this->resolveCarrierCode($fallbackFreightResult['responseBody']);
            if ($fallbackCarrierCode !== null) {
                $freightResult = $fallbackFreightResult;
                $carrierCode = $fallbackCarrierCode;
            }
        }

        if ($carrierCode === null) {
            $message = $this->extractOperationMessage($freightResult['responseBody']);
            $defaultCarrier = trim((string) env('ALIEXPRESS_DS_DEFAULT_LOGISTICS', ''));
            if ($message === null && $defaultCarrier !== '') {
                $carrierCode = $defaultCarrier;
            } else {
                throw new RuntimeException($message !== null ? "Verification livraison DS impossible: {$message}" : "Aucune option de livraison AliExpress n'a ete retournee pour ce lot.");
            }
        }

        $buyNowPayload = [
            'out_order_id' => 'AFRIPAY-'.Str::upper(Str::random(12)),
            'logistics_address' => [
                'address' => (string) ($address['addressLine1'] ?? ''),
                'address2' => (string) ($address['addressLine2'] ?? ''),
                'city' => $validatedAddress['city'],
                'contact_person' => (string) ($address['contactName'] ?? ''),
                'country' => $countryCode,
                'full_name' => (string) ($address['contactName'] ?? ''),
                'locale' => $language,
                'mobile_no' => (string) ($address['phone'] ?? ''),
                'phone_country' => '+',
                'province' => $validatedAddress['state'],
                'zip' => (string) ($address['postalCode'] ?? ''),
            ],
            'product_items' => [[
                'product_id' => (string) ($product['sourceProductId'] ?? ''),
                'product_count' => (string) $quantity,
                'sku_attr' => $skuAttr,
                'logistics_service_name' => $carrierCode,
                'order_memo' => 'Batch AfriPay '.trim((string) ($product['shortTitle'] ?? $product['title'] ?? 'AliExpress')),
            ]],
        ];

        return [
            'account' => $account,
            'liveProduct' => $liveProduct,
            'freightResult' => $freightResult,
            'buyNowPayload' => $buyNowPayload,
            'carrierCode' => $carrierCode,
            'skuId' => $skuId,
            'skuAttr' => $skuAttr,
        ];
    }

    private function prepareAlibabaDraftOrder(array $account, array $product, array $address, int $quantity): array
    {
        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $countryCode = strtoupper(trim((string) ($address['countryCode'] ?? env('ALIBABA_SHIP_TO_COUNTRY', 'FR'))));
        $dispatchLocation = strtoupper(trim((string) ($product['dispatchLocation'] ?? $account['defaultDispatchLocation'] ?? env('ALIBABA_DISPATCH_LOCATION', 'CN'))));
        $sourceProductId = (string) ($product['sourceProductId'] ?? '');
        if ($sourceProductId === '') {
            throw new RuntimeException('product_id Alibaba manquant pour creer la commande BuyNow.');
        }

        $skuId = $this->extractSkuIdFromVariantSkus($product['variantSkus'] ?? null)
            ?? $this->extractSkuId($product['rawPayload'] ?? null)
            ?? $this->getString($product['skuId'] ?? null);
        if ($skuId === null) {
            throw new RuntimeException('sku_id Alibaba introuvable pour cet article. Reimporte le produit puis relance le lot.');
        }

        $shipmentAddress = [
            'zip' => (string) ($address['postalCode'] ?? ''),
            'country' => (string) ($address['countryName'] ?? $countryCode),
            'address' => trim((string) ($address['addressLine1'] ?? '').' '.(string) ($address['addressLine2'] ?? '')),
            'city' => (string) ($address['city'] ?? ''),
            'contact_person' => (string) ($address['contactName'] ?? ''),
            'telephone' => [
                'area' => '',
                'country' => '',
                'number' => (string) ($address['phone'] ?? ''),
            ],
            'province_code' => (string) ($address['stateCode'] ?? ''),
            'country_code' => $countryCode,
            'province' => (string) ($address['state'] ?? ''),
            'port' => (string) ($address['port'] ?? ''),
            'alternate_address' => (string) ($address['addressLine2'] ?? ''),
            'port_code' => (string) ($address['portCode'] ?? ''),
        ];

        $freightPayload = [
            'destination_country' => $countryCode,
            'product_id' => $sourceProductId,
            'quantity' => (string) $quantity,
            'zip_code' => (string) ($address['postalCode'] ?? ''),
            'dispatch_location' => $dispatchLocation,
            'enable_distribution_waybill' => 'false',
        ];
        $freightResult = $this->callRestEndpoint($account, '/shipping/freight/calculate', $freightPayload);
        $carrierCode = $this->resolveAlibabaCarrierCode($freightResult['responseBody'])
            ?? $this->getString($account['defaultCarrierCode'] ?? null)
            ?? env('ALIBABA_DEFAULT_CARRIER_CODE', null);

        if ($carrierCode === null || trim((string) $carrierCode) === '') {
            $message = $this->extractOperationMessage($freightResult['responseBody']);
            throw new RuntimeException($message !== null ? "Verification livraison Alibaba impossible: {$message}" : "Aucune option de livraison Alibaba n'a ete retournee pour ce lot.");
        }

        $buyNowPayload = [
            'channel_refer_id' => 'AFRIPAY-'.Str::upper(Str::random(12)),
            'logistics_detail' => [
                'shipment_address' => $shipmentAddress,
                'dispatch_location' => $dispatchLocation,
                'carrier_code' => $carrierCode,
            ],
            'product_list' => [[
                'quantity' => (string) $quantity,
                'product_id' => $sourceProductId,
                'sku_id' => $skuId,
            ]],
            'properties' => json_encode([
                'platform' => 'AfriPay',
                'orderId' => 'AFRIPAY-'.Str::upper(Str::random(8)),
            ], JSON_UNESCAPED_SLASHES),
            'remark' => 'AfriPay Alibaba dropshipping order',
            'enable_distribution_waybill' => 'false',
        ];

        return [
            'account' => $account,
            'liveProduct' => $product,
            'freightResult' => $freightResult,
            'buyNowPayload' => $buyNowPayload,
            'carrierCode' => (string) $carrierCode,
            'skuId' => $skuId,
            'skuAttr' => '',
        ];
    }

    private function createAlibabaBuyNowOrder(array $account, array $buyNowPayload): array
    {
        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $result = $this->callRestEndpoint($account, '/buynow/order/create', $buyNowPayload);

        return [
            'account' => $account,
            'result' => $result,
        ];
    }

    private function queryAlibabaPaymentResult(array $account, string $tradeId): array
    {
        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $result = $this->callRestEndpoint($account, '/alibaba/order/pay/result/query', [
            'trade_id' => trim($tradeId),
        ]);

        return [
            'account' => $account,
            'result' => $result,
        ];
    }

    public function createDsOrder(array $account, array $buyNowPayload): array
    {
        if (($account['provider'] ?? null) === 'alibaba') {
            return $this->createAlibabaBuyNowOrder($account, $buyNowPayload);
        }

        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $dsExtendRequest = json_encode([
            'payment' => [
                'pay_currency' => 'USD',
                'try_to_pay' => 'true',
            ],
        ], JSON_UNESCAPED_SLASHES);

        $result = $this->callTopEndpoint($account, 'aliexpress.ds.order.create', [
            'ds_extend_request' => $dsExtendRequest,
            'param_place_order_request4_open_api_d_t_o' => json_encode($buyNowPayload, JSON_UNESCAPED_SLASHES),
        ]);

        return [
            'account' => $account,
            'result' => $result,
        ];
    }

    public function queryPaymentResult(array $account, string $tradeId): array
    {
        if (($account['provider'] ?? null) === 'alibaba') {
            return $this->queryAlibabaPaymentResult($account, $tradeId);
        }

        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $result = $this->callTopEndpoint($account, 'aliexpress.trade.ds.order.get', [
            'single_order_query' => json_encode(['order_id' => trim($tradeId)], JSON_UNESCAPED_SLASHES),
        ]);

        return [
            'account' => $account,
            'result' => $result,
        ];
    }

    public function payDropshippingOrder(array $account, string $tradeId, array $options = []): array
    {
        if (($account['provider'] ?? null) !== 'alibaba') {
            return [
                'account' => $account,
                'result' => [
                    'ok' => true,
                    'endpoint' => 'aliexpress.ds.order.create',
                    'requestBody' => ['tradeId' => $tradeId],
                    'responseBody' => [
                        'code' => '0',
                        'result' => [
                            'success' => 'true',
                            'provider' => 'aliexpress-ds',
                            'message' => "AliExpress DS utilise l'auto-paiement integre a la creation de commande.",
                        ],
                    ],
                    'status' => 200,
                ],
            ];
        }

        $prepared = $this->prepareAccount($account, true);
        $account = $prepared['account'];
        $request = array_filter([
            'user_ip' => $this->getString($options['userIp'] ?? null) ?? env('ALIBABA_DROPSHIPPING_USER_IP', '127.0.0.1'),
            'isv_drop_shipper_registration_time' => $this->getString($options['registrationTime'] ?? null) ?? (string) (time() * 1000),
            'order_id_list' => [$tradeId],
            'is_pc' => 'true',
            'accept_language' => $this->getString($options['acceptLanguage'] ?? null) ?? 'en-US,en;q=0.9',
            'screen_resolution' => $this->getString($options['screenResolution'] ?? null) ?? '1440*900',
            'user_agent' => $this->getString($options['userAgent'] ?? null) ?? 'Mozilla/5.0 AfriPay Alibaba Dropshipping',
            'payment_method' => $this->getString($options['paymentMethod'] ?? null) ?? env('ALIBABA_DROPSHIPPING_PAYMENT_METHOD', 'CREDIT_CARD'),
        ], fn ($value) => $value !== null && $value !== '');

        $result = $this->callRestEndpoint($account, '/alibaba/dropshipping/order/pay', [
            'param_order_pay_request' => $request,
        ]);

        return [
            'account' => $account,
            'result' => $result,
        ];
    }

    public function extractTradeIdFromResponse($responseBody): ?string
    {
        return $this->extractTradeId($responseBody);
    }

    public function extractOperationCodeFromResponse($responseBody): ?string
    {
        return $this->extractOperationCode($responseBody);
    }

    public function extractOperationMessageFromResponse($responseBody): ?string
    {
        return $this->extractOperationMessage($responseBody);
    }

    public function isOperationSuccessful($responseBody): bool
    {
        return $this->isSuccessfulOperation($responseBody);
    }

    public function extractTradePayUrl($responseBody): ?string
    {
        $wrapped = $this->toArray($responseBody);
        $candidates = [
            $wrapped['aliexpress_trade_ds_order_get_response']['result'] ?? null,
            $wrapped['result'] ?? null,
            $wrapped['value'] ?? null,
            $wrapped,
        ];

        foreach ($candidates as $candidate) {
            if (! $this->isAssoc($candidate)) {
                continue;
            }

            $value = $this->getString($candidate['pay_url'] ?? $candidate['payUrl'] ?? $candidate['cashier_url'] ?? $candidate['cashierUrl'] ?? $candidate['payment_url'] ?? $candidate['paymentUrl'] ?? $candidate['pay_url_https'] ?? $candidate['pay_url_http'] ?? null);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    public function extractTradeOrderStatus($responseBody): ?string
    {
        $wrapped = $this->toArray($responseBody);
        $candidates = [
            $wrapped['aliexpress_trade_ds_order_get_response']['result'] ?? null,
            $wrapped['result'] ?? null,
            $wrapped['value'] ?? null,
            $wrapped['data'] ?? null,
            $wrapped,
        ];

        foreach ($candidates as $candidate) {
            if (! $this->isAssoc($candidate)) {
                continue;
            }

            $value = $this->getString($candidate['order_status'] ?? $candidate['status'] ?? null);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    public function extractTradeError($responseBody): ?array
    {
        $body = $this->toArray($responseBody);
        $errorResponse = $body['error_response'] ?? null;
        if (! $this->isAssoc($errorResponse)) {
            return null;
        }

        return [
            'code' => $this->getString($errorResponse['code'] ?? null),
            'subCode' => $this->getString($errorResponse['sub_code'] ?? null),
            'message' => $this->getString($errorResponse['msg'] ?? $errorResponse['message'] ?? null),
            'subMessage' => $this->getString($errorResponse['sub_msg'] ?? null),
        ];
    }

    private function prepareAccount(array $account, bool $requireToken): array
    {
        if ($requireToken && $this->tokenExpiringSoon($account['accessTokenExpiresAt'] ?? null) && trim((string) ($account['refreshToken'] ?? '')) !== '') {
            $refreshed = $this->refreshTokens($account);
            $account = $refreshed['account'];
        }

        $appKey = trim((string) ($account['appKey'] ?? ''));
        $appSecret = trim((string) ($account['appSecret'] ?? ''));
        $accessToken = trim((string) ($account['accessToken'] ?? ''));
        if ($appKey === '' || $appSecret === '' || ($requireToken && $accessToken === '')) {
            throw new RuntimeException('Compte Open Platform introuvable ou incomplet. Reconnecte le compte fournisseur.');
        }

        return ['account' => $account];
    }

    private function callTopEndpoint(array $account, string $method, array $payload): array
    {
        $query = [
            'method' => $method,
            'app_key' => (string) ($account['appKey'] ?? ''),
            'timestamp' => (string) round(microtime(true) * 1000),
            'sign_method' => 'sha256',
            'access_token' => (string) ($account['accessToken'] ?? ''),
        ];

        foreach ($payload as $key => $value) {
            $query[$key] = $this->serializeValue($value);
        }

        $query['sign'] = $this->signTopRequest($query, (string) ($account['appSecret'] ?? ''));
        $requestUrl = $this->normalizeBaseUrl((string) ($account['apiBaseUrl'] ?? 'https://api-sg.aliexpress.com')).'/sync';
        $response = Http::timeout((int) env('ALIEXPRESS_TIMEOUT', 20))
            ->asForm()
            ->post($requestUrl, $query);

        $parsed = $this->parseHttpResponse($response->body());
        $apiLevelError = $response->successful() && $this->isAssoc($parsed['error_response'] ?? null);

        return [
            'ok' => $response->successful() && ! $apiLevelError,
            'endpoint' => $method,
            'requestBody' => $payload,
            'responseBody' => $parsed,
            'status' => $response->status(),
        ];
    }

    private function callRestEndpoint(array $account, string $pathOrUrl, array $payload, bool $includeAccessToken = true): array
    {
        $endpoint = $this->resolveEndpoint($pathOrUrl, (string) ($account['apiBaseUrl'] ?? self::ALIBABA_API_BASE_URL));
        $system = [
            'app_key' => (string) ($account['appKey'] ?? ''),
            'timestamp' => (string) round(microtime(true) * 1000),
            'sign_method' => 'sha256',
            'simplify' => 'true',
        ];

        if ($includeAccessToken) {
            $accessToken = trim((string) ($account['accessToken'] ?? ''));
            if ($accessToken !== '') {
                $system['access_token'] = $accessToken;
            }
        }

        $params = [];
        foreach ($payload as $key => $value) {
            $params[$key] = $this->serializeValue($value);
        }

        $signParams = array_merge($system, $params);
        ksort($signParams);
        $params = array_merge($params, $system, [
            'sign' => $this->signRestRequest($endpoint['apiPath'], $signParams, (string) ($account['appSecret'] ?? '')),
        ]);

        $response = Http::timeout((int) env('ALIEXPRESS_TIMEOUT', 20))
            ->asForm()
            ->post($endpoint['requestUrl'], $params);

        return [
            'ok' => $response->successful(),
            'endpoint' => $endpoint['apiPath'],
            'requestBody' => $payload,
            'responseBody' => $this->parseHttpResponse($response->body()),
            'status' => $response->status(),
        ];
    }

    private function resolveEndpoint(string $pathOrUrl, string $apiBaseUrl): array
    {
        if (str_starts_with($pathOrUrl, 'http://') || str_starts_with($pathOrUrl, 'https://')) {
            $parts = parse_url($pathOrUrl);
            $pathname = (string) ($parts['path'] ?? '/');
            $apiPath = str_starts_with($pathname, '/rest/') ? substr($pathname, 5) : $pathname;
            return [
                'requestUrl' => $pathOrUrl,
                'apiPath' => str_starts_with($apiPath, '/') ? $apiPath : '/'.$apiPath,
            ];
        }

        $apiPath = str_starts_with($pathOrUrl, '/') ? $pathOrUrl : '/'.$pathOrUrl;
        return [
            'requestUrl' => $this->normalizeBaseUrl($apiBaseUrl).'/rest'.$apiPath,
            'apiPath' => $apiPath,
        ];
    }

    private function signTopRequest(array $params, string $secret): string
    {
        unset($params['sign']);
        ksort($params);
        $base = '';
        foreach ($params as $key => $value) {
            $base .= $key.$value;
        }

        return strtoupper(hash_hmac('sha256', $base, $secret));
    }

    private function signRestRequest(string $apiPath, array $params, string $secret): string
    {
        unset($params['sign']);
        ksort($params);
        $base = $apiPath;
        foreach ($params as $key => $value) {
            $base .= $key.$value;
        }

        return strtoupper(hash_hmac('sha256', $base, $secret));
    }

    private function normalizeBaseUrl(string $value): string
    {
        return rtrim(trim($value) !== '' ? trim($value) : self::ALIBABA_API_BASE_URL, '/');
    }

    private function serializeValue($value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_string($value)) {
            return $value;
        }

        if (is_numeric($value) || is_bool($value)) {
            return (string) $value;
        }

        return json_encode($value, JSON_UNESCAPED_SLASHES) ?: '';
    }

    private function parseHttpResponse(string $body)
    {
        $decoded = json_decode($body, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $body;
    }

    private function normalizeSortBy($value): string
    {
        $normalized = strtolower(trim((string) $value));
        if ($normalized === '') {
            return 'orders,desc';
        }

        [$field, $direction] = array_pad(array_map('trim', explode(',', $normalized, 2)), 2, '');
        $safeField = preg_match('/^[a-z_]+$/i', $field) === 1 ? $field : 'orders';
        $safeDirection = in_array($direction, ['asc', 'desc'], true) ? $direction : 'desc';

        return $safeField.','.$safeDirection;
    }

    private function normalizeDsOperation($value): ?string
    {
        $normalized = strtolower(trim((string) $value));
        if ($normalized === '') {
            return null;
        }

        $normalized = str_replace(['/', '\\', ' '], ['.', '.', ''], $normalized);

        return match ($normalized) {
            'ds.feedname.get', 'aliexpress.ds.feedname.get' => 'aliexpress.ds.feedname.get',
            'ds.feed.itemids.get', 'aliexpress.ds.feed.itemids.get' => 'aliexpress.ds.feed.itemids.get',
            'ds.product.get', 'aliexpress.ds.product.get' => 'aliexpress.ds.product.get',
            'ds.freight.query', 'aliexpress.ds.freight.query' => 'aliexpress.ds.freight.query',
            'ds.address.get', 'aliexpress.ds.address.get' => 'aliexpress.ds.address.get',
            'ds.order.tracking.get', 'aliexpress.ds.order.tracking.get' => 'aliexpress.ds.order.tracking.get',
            'trade.ds.order.get', 'aliexpress.trade.ds.order.get' => 'aliexpress.trade.ds.order.get',
            'ds.image.searchv2', 'aliexpress.ds.image.searchv2', 'aliexpress.ds.image.searchv2' => 'aliexpress.ds.image.searchv2',
            'ds.text.search', 'aliexpress.ds.text.search' => 'aliexpress.ds.text.search',
            default => $normalized,
        };
    }

    private function requireProbeString(array $input, array $keys, string $fieldName, ?string $default = null): string
    {
        foreach ($keys as $key) {
            $value = $this->getString($input[$key] ?? null);
            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        if ($default !== null && trim($default) !== '') {
            return trim($default);
        }

        throw new RuntimeException("Parametre AliExpress DS manquant: {$fieldName}.");
    }

    private function stringOrDefault($value, string $default): string
    {
        $normalized = $this->getString($value);

        return $normalized !== null && $normalized !== '' ? $normalized : $default;
    }

    private function normalizeProbeBoolean($value): string
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        $normalized = strtolower(trim((string) $value));

        return in_array($normalized, ['1', 'true', 'yes', 'oui'], true) ? 'true' : 'false';
    }

    private function normalizeSearchExtend($value): ?string
    {
        $entries = is_array($value) ? $value : [];
        $normalized = [];
        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $row = array_filter([
                'searchKey' => $this->getString($entry['searchKey'] ?? null),
                'searchValue' => $this->getString($entry['searchValue'] ?? null),
                'min' => $this->getString($entry['min'] ?? null),
                'max' => $this->getString($entry['max'] ?? null),
            ], fn ($item) => $item !== null && $item !== '');

            if ($row !== []) {
                $normalized[] = $row;
            }
        }

        return $normalized === [] ? null : json_encode(array_values($normalized), JSON_UNESCAPED_SLASHES);
    }

    private function getSellerPayload($responseBody): array
    {
        $body = $this->toArray($responseBody);
        if ($this->isAssoc($body['resp_result'] ?? null)) {
            $envelope = $body['resp_result'];
            return $this->isAssoc($envelope['result'] ?? null) ? $envelope['result'] : $envelope;
        }

        if ($this->isAssoc($body['result'] ?? null)) {
            return $body['result'];
        }

        foreach ($body as $key => $value) {
            if (is_string($key) && str_starts_with($key, 'aliexpress_') && str_ends_with($key, '_response') && $this->isAssoc($value)) {
                return $this->isAssoc($value['result'] ?? null) ? $value['result'] : $value;
            }
        }

        if ($this->isAssoc($body['aliexpress_ds_order_create_response'] ?? null)) {
            $envelope = $body['aliexpress_ds_order_create_response'];
            return $this->isAssoc($envelope['result'] ?? null) ? $envelope['result'] : $envelope;
        }

        if ($this->isAssoc($body['aliexpress_ds_product_get_response'] ?? null)) {
            $envelope = $body['aliexpress_ds_product_get_response'];
            return $this->isAssoc($envelope['result'] ?? null) ? $envelope['result'] : $envelope;
        }

        if ($this->isAssoc($body['aliexpress_ds_text_search'] ?? null)) {
            return $body['aliexpress_ds_text_search'];
        }

        return $body;
    }

    private function extractSearchItems($payload): array
    {
        $parsedPayload = $this->parseSearchContainer($payload);
        if (! is_array($parsedPayload)) {
            return [];
        }

        $candidates = [
            $parsedPayload,
            $this->parseSearchContainer($parsedPayload['data'] ?? null),
            $this->parseSearchContainer($parsedPayload['result'] ?? null),
            $this->parseSearchContainer($parsedPayload['page_result'] ?? null),
            $this->parseSearchContainer($parsedPayload['pageResult'] ?? null),
            $this->parseSearchContainer($parsedPayload['search_result'] ?? null),
            $this->parseSearchContainer($parsedPayload['searchResult'] ?? null),
        ];

        foreach ($candidates as $candidate) {
            $records = $this->normalizeSearchArray($candidate);
            if ($records !== []) {
                return $records;
            }
        }

        foreach ($this->collectObjectNodes($parsedPayload) as $node) {
            foreach (['products', 'product_list', 'products_list', 'productsList', 'item_list', 'items', 'records', 'result_list', 'content', 'list', 'data', 'result'] as $key) {
                $records = $this->normalizeSearchArray($node[$key] ?? null);
                if ($records !== []) {
                    return $records;
                }
            }

            foreach ($node as $value) {
                $records = $this->normalizeSearchArray($value);
                if ($records !== []) {
                    return $records;
                }
            }
        }

        return [];
    }

    private function parseSearchContainer($value)
    {
        if (! is_string($value)) {
            return $value;
        }

        $trimmed = trim($value);
        if (! str_starts_with($trimmed, '{') && ! str_starts_with($trimmed, '[')) {
            return $value;
        }

        $decoded = json_decode($trimmed, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
    }

    private function normalizeSearchArray($value): array
    {
        $parsed = $this->parseSearchContainer($value);
        if (! is_array($parsed) || $this->isAssoc($parsed)) {
            return [];
        }

        $records = [];
        foreach ($parsed as $entry) {
            $candidate = $this->parseSearchContainer($entry);
            if ($this->isSearchRecord($candidate)) {
                $records[] = $candidate;
            }
        }

        return $records;
    }

    private function isSearchRecord($value): bool
    {
        if (! $this->isAssoc($value)) {
            return false;
        }

        $hasId = $this->getString($value['itemId'] ?? $value['item_id'] ?? $value['product_id'] ?? $value['productId'] ?? null) !== null;
        $hasLabel = $this->getString($value['title'] ?? $value['item_title'] ?? $value['subject'] ?? $value['itemMainPic'] ?? $value['item_main_pic'] ?? $value['salePrice'] ?? $value['sale_price'] ?? $value['targetSalePrice'] ?? $value['target_sale_price'] ?? null) !== null;

        return $hasId && $hasLabel;
    }

    private function buildSearchPreviewItem(array $searchItem, string $query, string $shipToCountry, $detailResponseBody, bool $detailOk): ?array
    {
        $productId = $this->getString($searchItem['itemId'] ?? $searchItem['item_id'] ?? $searchItem['product_id'] ?? $searchItem['productId'] ?? null);
        if ($productId === null) {
            return null;
        }

        $detailProduct = $detailOk ? $this->mapDetailProduct($searchItem, $detailResponseBody, $query) : null;
        $fallbackProduct = $detailProduct === null ? $this->mapSearchFallbackProduct($searchItem, $query, $shipToCountry) : null;
        $product = $detailProduct ?? $fallbackProduct;

        return [
            'productId' => $productId,
            'title' => $this->getString($searchItem['title'] ?? null) ?? ($product['shortTitle'] ?? $product['title'] ?? $productId),
            'itemUrl' => $this->getString($searchItem['itemUrl'] ?? $searchItem['item_url'] ?? null),
            'imageUrl' => $this->getString($searchItem['itemMainPic'] ?? $searchItem['item_main_pic'] ?? null) ?? ($product['image'] ?? null),
            'videoUrl' => $this->getString($searchItem['productVideoUrl'] ?? $searchItem['product_video_url'] ?? null) ?? ($product['videoUrl'] ?? null),
            'salePrice' => $this->getString($searchItem['salePrice'] ?? $searchItem['sale_price'] ?? null),
            'salePriceFormat' => $this->getString($searchItem['salePriceFormat'] ?? $searchItem['sale_price_format'] ?? null),
            'salePriceCurrency' => $this->getString($searchItem['salePriceCurrency'] ?? $searchItem['sale_price_currency'] ?? null),
            'originalPrice' => $this->getString($searchItem['originalPrice'] ?? $searchItem['original_price'] ?? null),
            'originalPriceFormat' => $this->getString($searchItem['originalPriceFormat'] ?? $searchItem['original_price_format'] ?? null),
            'originalPriceCurrency' => $this->getString($searchItem['originalPriceCurrency'] ?? $searchItem['original_price_currency'] ?? null),
            'targetSalePrice' => $this->getString($searchItem['targetSalePrice'] ?? $searchItem['target_sale_price'] ?? null),
            'targetOriginalPrice' => $this->getString($searchItem['targetOriginalPrice'] ?? $searchItem['target_original_price'] ?? null),
            'targetOriginalPriceCurrency' => $this->getString($searchItem['targetOriginalPriceCurrency'] ?? $searchItem['target_original_price_currency'] ?? null),
            'discount' => $this->getString($searchItem['discount'] ?? null),
            'orders' => $this->getString($searchItem['orders'] ?? null),
            'score' => $this->getString($searchItem['score'] ?? null),
            'evaluateRate' => $this->getString($searchItem['evaluateRate'] ?? $searchItem['evaluate_rate'] ?? null),
            'categoryId' => $this->getString($searchItem['cateId'] ?? $searchItem['cate_id'] ?? null),
            'importable' => $product !== null,
            'importSource' => $detailProduct !== null ? 'detail' : ($fallbackProduct !== null ? 'search_fallback' : null),
            'importReason' => $product !== null ? null : "La recherche a renvoye l'article mais aucun payload DS importable n'a pu etre reconstruit.",
            'product' => $product,
        ];
    }

    private function mapSearchFallbackProduct(array $searchItem, string $query, string $shipToCountry): ?array
    {
        $sourceProductId = $this->getString($searchItem['itemId'] ?? $searchItem['item_id'] ?? $searchItem['product_id'] ?? $searchItem['productId'] ?? null);
        if ($sourceProductId === null) {
            return null;
        }

        $gallery = array_values(array_unique(array_filter(array_merge(
            $this->collectStrings($searchItem['itemMainPic'] ?? null),
            $this->collectStrings($searchItem['item_main_pic'] ?? null),
            $this->collectStrings($searchItem['item_main_pic_url'] ?? null),
            $this->collectStrings($searchItem['image_url'] ?? null),
            $this->collectStrings($searchItem['imageUrl'] ?? null),
            $this->collectStrings($searchItem['productMainImageUrl'] ?? null),
            $this->collectStrings($searchItem['product_main_image_url'] ?? null),
            $this->collectStrings($searchItem['productSmallImageUrls'] ?? null),
            $this->collectStrings($searchItem['product_small_image_urls'] ?? null)
        ))));
        $primaryImage = $gallery[0] ?? null;
        if ($primaryImage === null) {
            return null;
        }

        $priceBounds = $this->getPriceBounds([
            $searchItem['targetSalePrice'] ?? null,
            $searchItem['salePrice'] ?? null,
            $searchItem['discountPrice'] ?? null,
            $searchItem['appSalePrice'] ?? null,
            $searchItem['target_sale_price'] ?? null,
            $searchItem['sale_price'] ?? null,
            $searchItem['discount_price'] ?? null,
            $searchItem['app_sale_price'] ?? null,
            $searchItem['min_price'] ?? null,
            $searchItem['max_price'] ?? null,
        ]);
        $fallbackBounds = $this->getPriceBounds([
            $searchItem['targetOriginalPrice'] ?? null,
            $searchItem['originalPrice'] ?? null,
            $searchItem['target_original_price'] ?? null,
            $searchItem['original_price'] ?? null,
            $searchItem['originMinPrice'] ?? null,
            $searchItem['origin_min_price'] ?? null,
        ]);
        $minRawPrice = $priceBounds['min'] ?? $fallbackBounds['min'] ?? null;
        if ($minRawPrice === null) {
            return null;
        }

        $title = $this->getString($searchItem['title'] ?? $searchItem['product_title'] ?? $searchItem['item_title'] ?? $searchItem['subject'] ?? null) ?? $query;
        $maxRawPrice = $priceBounds['max'] ?? $fallbackBounds['max'] ?? null;
        $packageDimensions = $this->extractPackageDimensionsCm($searchItem) ?? $this->parsePackagingDimensions('Selon catalogue');
        $weightGrams = $this->extractWeightGrams($searchItem) ?? 0;
        $lotCbm = $this->formatLotCbm($packageDimensions);

        return [
            'sourceProductId' => $sourceProductId,
            'slug' => $sourceProductId,
            'title' => $title,
            'shortTitle' => Str::limit($title, 96, '...'),
            'keywords' => array_slice(array_values(array_filter(preg_split('/[^a-z0-9]+/i', strtolower($title)) ?: [], fn ($entry) => strlen($entry) > 2)), 0, 12),
            'image' => $primaryImage,
            'gallery' => $gallery,
            'packaging' => 'Selon catalogue',
            'packageDimensionsCm' => $packageDimensions,
            'itemWeightGrams' => $weightGrams,
            'lotCbm' => $lotCbm,
            'minUsd' => $this->applyAliExpressMargin($minRawPrice),
            'maxUsd' => $maxRawPrice !== null ? $this->applyAliExpressMargin($maxRawPrice) : null,
            'moq' => 1,
            'unit' => 'piece',
            'badge' => 'AliExpress DS',
            'supplierName' => $this->getString($searchItem['storeName'] ?? $searchItem['store_name'] ?? $searchItem['sellerName'] ?? $searchItem['seller_name'] ?? $searchItem['shop_name'] ?? null) ?? 'Selection AfriPay+',
            'supplierLocation' => $this->getString($searchItem['storeCountryCode'] ?? $searchItem['store_country_code'] ?? $searchItem['ship_from'] ?? null) ?? 'CN',
            'supplierCompanyId' => null,
            'responseTime' => 'Sous 24 h',
            'yearsInBusiness' => 1,
            'transactionsLabel' => 'AliExpress DS live',
            'soldLabel' => $this->getString($searchItem['orders'] ?? $searchItem['latest_volume'] ?? $searchItem['tradeDesc'] ?? $searchItem['trade_desc'] ?? $searchItem['sales_count'] ?? $searchItem['salesCount'] ?? null) ?? '0',
            'customizationLabel' => 'Selon catalogue',
            'shippingLabel' => 'Livraison '.strtoupper($shipToCountry),
            'overview' => ['Produit reconstruit depuis la recherche DS AliExpress.'],
            'variantGroups' => [],
            'variantPricing' => [],
            'variantSkus' => [],
            'tiers' => [[
                'quantityLabel' => '1+',
                'priceUsd' => $this->applyAliExpressMargin($minRawPrice),
            ]],
            'specs' => [],
            'moqVerified' => true,
            'weightVerified' => $weightGrams > 0,
            'priceVerified' => true,
            'inventory' => 0,
            'description' => $title,
            'rawPayload' => $searchItem,
        ];
    }

    private function mapDetailProduct(array $searchItem, $detailResponseBody, string $query): ?array
    {
        $detailResult = $this->getSellerPayload($detailResponseBody);
        if ($detailResult === []) {
            return null;
        }

        $baseInfo = $this->toArray($detailResult['ae_item_base_info_dto'] ?? []);
        $multimedia = $this->toArray($detailResult['ae_multimedia_info_dto'] ?? []);
        $storeInfo = $this->toArray($detailResult['ae_store_info'] ?? []);
        $packageInfo = $this->toArray($detailResult['package_info_dto'] ?? []);
        $skuInfo = is_array($detailResult['ae_item_sku_info_dtos'] ?? null) ? $detailResult['ae_item_sku_info_dtos'] : (is_array($detailResult['sku_info'] ?? null) ? $detailResult['sku_info'] : []);
        $properties = is_array($detailResult['ae_item_properties'] ?? null) ? $detailResult['ae_item_properties'] : [];

        $sourceProductId = $this->getString($baseInfo['product_id'] ?? $searchItem['itemId'] ?? $searchItem['product_id'] ?? null);
        if ($sourceProductId === null) {
            return null;
        }

        $gallery = array_values(array_unique(array_filter(array_merge(
            $this->splitImages($multimedia['image_urls'] ?? null),
            $this->splitImages($multimedia['image_url'] ?? null),
            $this->splitImages($baseInfo['image_urls'] ?? null),
            $this->splitImages($detailResult['image_urls'] ?? null),
            $this->collectStrings($searchItem['itemMainPic'] ?? null),
            $this->collectStrings($searchItem['product_main_image_url'] ?? null),
            $this->collectStrings($searchItem['productMainImageUrl'] ?? null),
            $this->collectStrings($multimedia['image_url'] ?? null),
            $this->collectStrings($baseInfo['image_url'] ?? null),
            $this->collectStrings($detailResult['main_image_url'] ?? null),
            $this->collectStrings($detailResult['product_main_image_url'] ?? null),
            $this->collectStrings($detailResult['image_url'] ?? null),
            $this->extractImageCandidates($detailResult),
            $this->extractImageCandidates($detailResponseBody)
        ))));
        $primaryImage = $gallery[0] ?? null;
        if ($primaryImage === null) {
            return null;
        }

        $skuPrices = [];
        foreach ($skuInfo as $sku) {
            if (! is_array($sku)) {
                continue;
            }

            $price = $this->toFloat($sku['offer_sale_price'] ?? $sku['sku_price'] ?? null);
            if ($price > 0) {
                $skuPrices[] = $price;
            }
        }

        $detailSalePriceBounds = $this->getPriceBounds([
            $detailResult['targetSalePrice'] ?? null,
            $detailResult['salePrice'] ?? null,
            $detailResult['discountPrice'] ?? null,
            $detailResult['target_sale_price'] ?? null,
            $detailResult['sale_price'] ?? null,
            $detailResult['discount_price'] ?? null,
            $detailResult['min_price'] ?? null,
            $detailResult['max_price'] ?? null,
            $detailResult['price'] ?? null,
            $baseInfo['target_sale_price'] ?? null,
            $baseInfo['sale_price'] ?? null,
            $baseInfo['discount_price'] ?? null,
            $baseInfo['min_price'] ?? null,
            $baseInfo['max_price'] ?? null,
        ]);
        $searchSalePriceBounds = $this->getPriceBounds([
            $searchItem['targetSalePrice'] ?? null,
            $searchItem['salePrice'] ?? null,
            $searchItem['discountPrice'] ?? null,
            $searchItem['appSalePrice'] ?? null,
            $searchItem['target_sale_price'] ?? null,
            $searchItem['sale_price'] ?? null,
            $searchItem['discount_price'] ?? null,
            $searchItem['app_sale_price'] ?? null,
            $searchItem['min_price'] ?? null,
            $searchItem['max_price'] ?? null,
        ]);

        $minRawPrice = $skuPrices !== [] ? min($skuPrices) : ($detailSalePriceBounds['min'] ?? $searchSalePriceBounds['min'] ?? null);
        if ($minRawPrice === null || $minRawPrice <= 0) {
            return null;
        }

        $maxRawPrice = $skuPrices !== [] ? max($skuPrices) : ($detailSalePriceBounds['max'] ?? $searchSalePriceBounds['max'] ?? null);
        $moq = 1;
        foreach ($skuInfo as $sku) {
            if (! is_array($sku)) {
                continue;
            }

            $candidate = $this->toInt($sku['sku_bulk_order'] ?? null);
            if ($candidate > 0) {
                $moq = $candidate;
                break;
            }
        }

        $stock = 0;
        foreach ($skuInfo as $sku) {
            if (! is_array($sku)) {
                continue;
            }

            $stock = max($stock, $this->toInt($sku['sku_available_stock'] ?? null));
        }

        $title = $this->getString($baseInfo['subject'] ?? $detailResult['subject'] ?? $detailResult['product_title'] ?? $detailResult['title'] ?? $searchItem['title'] ?? null) ?? $query;
        $keywords = array_slice(array_values(array_filter(preg_split('/[^a-z0-9]+/i', strtolower($title)) ?: [], fn ($entry) => strlen($entry) > 2)), 0, 12);
        $packageDimensions = $this->extractPackageDimensionsCm($detailResult)
            ?? $this->extractPackageDimensionsCm($detailResponseBody)
            ?? $this->extractPackageDimensionsCm($searchItem)
            ?? [
                'lengthCm' => max(1, $this->toFloat($packageInfo['package_length'] ?? 20)),
                'widthCm' => max(1, $this->toFloat($packageInfo['package_width'] ?? 15)),
                'heightCm' => max(1, $this->toFloat($packageInfo['package_height'] ?? 8)),
            ];
        $weightGrams = $this->extractWeightGrams($detailResult)
            ?? $this->extractWeightGrams($searchItem)
            ?? (($weightKg = $this->toFloat($packageInfo['gross_weight'] ?? null)) > 0 ? (int) round($weightKg * ($weightKg < 10 ? 1000 : 1)) : 0);
        $packageLength = $packageDimensions['lengthCm'];
        $packageWidth = $packageDimensions['widthCm'];
        $packageHeight = $packageDimensions['heightCm'];
        $variantGroups = [];
        $variantGroupIndex = [];
        $variantPricing = [];
        $variantSkus = [];
        $tiers = [];

        foreach ($skuInfo as $index => $sku) {
            if (! is_array($sku)) {
                continue;
            }

            $propertyDtos = is_array($sku['ae_sku_property_dtos'] ?? null) ? $sku['ae_sku_property_dtos'] : [];
            $selections = [];
            foreach ($propertyDtos as $propertyIndex => $property) {
                if (! is_array($property)) {
                    continue;
                }

                $label = $this->getString($property['sku_property_name'] ?? null) ?? 'Option '.($propertyIndex + 1);
                $value = $this->getString($property['property_value_definition_name'] ?? $property['sku_property_value'] ?? null) ?? 'Valeur';
                $selections[$label] = $value;
                $variantGroupIndex[$label] = $variantGroupIndex[$label] ?? [];
                if (! in_array($value, $variantGroupIndex[$label], true)) {
                    $variantGroupIndex[$label][] = $value;
                }
            }

            $skuPriceRaw = $this->toFloat($sku['offer_sale_price'] ?? $sku['sku_price'] ?? $minRawPrice);
            $skuPriceUsd = $this->applyAliExpressMargin($skuPriceRaw > 0 ? $skuPriceRaw : $minRawPrice);
            if ($selections !== []) {
                $variantPricing[] = [
                    'selections' => $selections,
                    'priceUsd' => $skuPriceUsd,
                    'minPriceUsd' => $skuPriceUsd,
                    'minimumQuantity' => max(1, $this->toInt($sku['sku_bulk_order'] ?? $moq)),
                    'quantityLabel' => max(1, $this->toInt($sku['sku_bulk_order'] ?? $moq)).'+',
                    'note' => $this->getString($sku['sku_attr'] ?? null) ?? 'SKU '.($index + 1),
                ];
            }

            $skuId = $this->getString($sku['sku_id'] ?? $sku['id'] ?? null);
            if ($skuId !== null) {
                $variantSkus[] = [
                    'skuId' => $skuId,
                    'skuCode' => $this->getString($sku['sku_code'] ?? null),
                    'inventory' => $this->toInt($sku['sku_available_stock'] ?? null),
                    'image' => $this->getString($sku['sku_image'] ?? $sku['image_url'] ?? null),
                    'selections' => $selections,
                ];
            }

            $tiers[] = [
                'quantityLabel' => max(1, $this->toInt($sku['sku_bulk_order'] ?? $moq)).'+',
                'priceUsd' => $skuPriceUsd,
                'note' => $this->getString($sku['sku_attr'] ?? null) ?? 'SKU '.($index + 1),
            ];
        }

        foreach ($variantGroupIndex as $label => $values) {
            $variantGroups[] = ['label' => $label, 'values' => array_values($values)];
        }

        $specs = [];
        foreach (array_slice($properties, 0, 12) as $property) {
            if (! is_array($property)) {
                continue;
            }

            $specs[] = [
                'label' => $this->getString($property['attr_name'] ?? null) ?? 'Attribut',
                'value' => $this->getString($property['attr_value'] ?? $property['attr_value_start'] ?? null) ?? '-',
            ];
        }

        $sourceUrl = $this->getString($detailResult['original_link'] ?? $detailResult['detail_url'] ?? $detailResult['product_detail_url'] ?? $baseInfo['detail_url'] ?? $baseInfo['product_detail_url'] ?? null)
            ?? 'https://www.aliexpress.com/item/'.$sourceProductId.'.html';
        $mergedPayload = [
            'search' => $searchItem,
            'detail' => $detailResult,
            'itemUrl' => $sourceUrl,
            'provider' => 'aliexpress-ds',
            'margin_rate' => (float) env('ALIEXPRESS_MARGIN_RATE', 0.1),
        ];

        return [
            'sourceProductId' => $sourceProductId,
            'slug' => $sourceProductId,
            'title' => $title,
            'shortTitle' => Str::limit($title, 96, '...'),
            'description' => $title,
            'keywords' => $keywords,
            'image' => $primaryImage,
            'gallery' => $gallery,
            'videoUrl' => $this->getString($multimedia['video_url'] ?? $detailResult['product_video_url'] ?? null),
            'videoPoster' => $primaryImage,
            'packaging' => 'Carton export standard',
            'packageDimensionsCm' => [
                'lengthCm' => $packageLength,
                'widthCm' => $packageWidth,
                'heightCm' => $packageHeight,
            ],
            'itemWeightGrams' => $weightGrams,
            'lotCbm' => number_format(($packageLength * $packageWidth * $packageHeight) / 1000000, 4, '.', ''),
            'minUsd' => $this->applyAliExpressMargin($minRawPrice),
            'maxUsd' => $maxRawPrice !== null ? $this->applyAliExpressMargin($maxRawPrice) : null,
            'moq' => max(1, $moq),
            'moqVerified' => true,
            'unit' => 'piece',
            'badge' => 'AliExpress DS',
            'supplierName' => $this->getString($storeInfo['store_name'] ?? $searchItem['storeName'] ?? $searchItem['store_name'] ?? null) ?? 'AliExpress Supplier',
            'supplierLocation' => $this->getString($storeInfo['country_code'] ?? $searchItem['storeCountryCode'] ?? $searchItem['store_country_code'] ?? null) ?? 'CN',
            'supplierCompanyId' => $this->getString($storeInfo['store_id'] ?? null),
            'responseTime' => 'Sous 24 h',
            'yearsInBusiness' => 1,
            'transactionsLabel' => 'AliExpress DS live',
            'soldLabel' => $this->getString($searchItem['orders'] ?? null) ?? 'AliExpress DS',
            'customizationLabel' => 'Selon fiche fournisseur',
            'shippingLabel' => 'Expedition AliExpress',
            'overview' => ['Produit detaille charge via aliexpress.ds.product.get.'],
            'variantGroups' => $variantGroups,
            'variantPricing' => $variantPricing,
            'variantSkus' => $variantSkus,
            'tiers' => $tiers !== [] ? array_slice($tiers, 0, 6) : [[
                'quantityLabel' => max(1, $moq).'+',
                'priceUsd' => $this->applyAliExpressMargin($minRawPrice),
            ]],
            'specs' => $specs,
            'weightVerified' => $weightGrams > 0,
            'priceVerified' => true,
            'inventory' => $stock,
            'rawPayload' => $mergedPayload,
        ];
    }

    private function splitImages($value): array
    {
        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return [];
            }

            $decoded = json_decode($trimmed, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $this->splitImages($decoded);
            }

            return array_values(array_filter(array_map('trim', preg_split('/[;,|]/', $trimmed) ?: [])));
        }

        if (is_array($value)) {
            $images = [];
            foreach ($value as $entry) {
                if (is_array($entry)) {
                    $images = array_merge($images, $this->splitImages($entry));
                    continue;
                }

                $candidate = trim((string) $entry);
                if ($candidate !== '') {
                    $images[] = $candidate;
                }
            }

            return array_values(array_filter($images));
        }

        return [];
    }

    private function extractImageCandidates($value, int $depth = 0, ?string $keyHint = null): array
    {
        if ($depth > 5 || $value === null) {
            return [];
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return [];
            }

            $isImageKey = is_string($keyHint) && preg_match('/image|img|photo|pic|poster|gallery/i', $keyHint) === 1;
            if ($isImageKey || preg_match('/^https?:\/\//i', $trimmed) === 1) {
                return $this->splitImages($trimmed);
            }

            return [];
        }

        if (! is_array($value)) {
            return [];
        }

        $images = [];
        foreach ($value as $nestedKey => $nestedValue) {
            $images = array_merge($images, $this->extractImageCandidates($nestedValue, $depth + 1, is_string($nestedKey) ? $nestedKey : $keyHint));
        }

        return array_values(array_unique(array_filter($images)));
    }

    private function getPriceBounds(array $values): array
    {
        $numbers = [];
        foreach ($values as $value) {
            $number = $this->toFloat($value);
            if ($number > 0) {
                $numbers[] = $number;
            }
        }

        if ($numbers === []) {
            return ['min' => null, 'max' => null];
        }

        return ['min' => min($numbers), 'max' => max($numbers)];
    }

    private function applyAliExpressMargin(float $priceUsd): float
    {
        $marginRate = (float) env('ALIEXPRESS_MARGIN_RATE', 0.1);
        $configured = is_finite($marginRate) && $marginRate >= 0 ? $marginRate : 0.1;
        $bounded = min($configured, 0.2);
        $dynamic = $priceUsd <= 5 ? min($bounded, 0.05) : ($priceUsd <= 20 ? min($bounded, 0.08) : $bounded);

        return round($priceUsd * (1 + $dynamic), 2);
    }

    private function extractSourceProductId(string $value): string
    {
        if (preg_match('/(?:^|\D)(\d{8,20})(?:\D|$)/', $value, $matches) === 1) {
            return $matches[1];
        }

        return '';
    }

    private function extractSkuId($rawPayload): ?string
    {
        $queue = [$rawPayload];
        while ($queue !== []) {
            $current = array_shift($queue);
            if (is_array($current)) {
                if ($this->isAssoc($current)) {
                    $direct = $this->getString($current['sku_id'] ?? $current['skuId'] ?? null);
                    if ($direct !== null) {
                        return $direct;
                    }

                    foreach (['ae_item_sku_info_dtos', 'sku_info', 'skus', 'skuInfo', 'trade_info', 'detail'] as $key) {
                        if (array_key_exists($key, $current)) {
                            $queue[] = $current[$key];
                        }
                    }
                    foreach ($current as $value) {
                        $queue[] = $value;
                    }
                } else {
                    foreach ($current as $entry) {
                        $queue[] = $entry;
                    }
                }
            }
        }

        return null;
    }

    private function extractSkuAttr($rawPayload, string $skuId): ?string
    {
        $queue = [$rawPayload];
        while ($queue !== []) {
            $current = array_shift($queue);
            if (! is_array($current)) {
                continue;
            }

            if ($this->isAssoc($current)) {
                foreach (['ae_item_sku_info_dtos', 'sku_info', 'skus', 'items'] as $key) {
                    $group = $current[$key] ?? null;
                    if (! is_array($group)) {
                        continue;
                    }

                    foreach ($group as $entry) {
                        if (! is_array($entry)) {
                            continue;
                        }

                        $candidateSkuId = $this->getString($entry['sku_id'] ?? $entry['skuId'] ?? $entry['id'] ?? null);
                        if ($candidateSkuId === $skuId) {
                            return $this->getString($entry['sku_attr'] ?? $entry['id'] ?? null) ?? '';
                        }
                    }
                }

                foreach ($current as $value) {
                    $queue[] = $value;
                }
            } else {
                foreach ($current as $entry) {
                    $queue[] = $entry;
                }
            }
        }

        return null;
    }

    private function extractSkuIdFromVariantSkus($variantSkus): ?string
    {
        if (! is_array($variantSkus)) {
            return null;
        }

        foreach ($variantSkus as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $skuId = $this->getString($entry['skuId'] ?? $entry['sku_id'] ?? $entry['id'] ?? null);
            if ($skuId !== null) {
                return $skuId;
            }
        }

        return null;
    }

    private function resolveValidatedAddress(array $account, array $address, string $language): array
    {
        $addressQuery = $this->callTopEndpoint($account, 'aliexpress.ds.address.get', [
            'countryCode' => strtoupper(trim((string) ($address['countryCode'] ?? ''))),
            'language' => $language,
            'isMultiLanguage' => 'true',
        ]);

        if (! $addressQuery['ok']) {
            return [
                'state' => (string) ($address['state'] ?? ''),
                'stateCode' => (string) ($address['state'] ?? ''),
                'city' => (string) ($address['city'] ?? ''),
                'cityCode' => (string) ($address['city'] ?? ''),
            ];
        }

        $options = $this->normalizeAddressOptions($addressQuery['responseBody']);
        $typedNodes = array_map(fn (array $entry) => [
            'type' => $this->normalizeComparableText($entry['type'] ?? ''),
            'nodes' => $this->parseAddressNodes($entry['childrenJson'] ?? null),
        ], $options);
        $allRoots = [];
        foreach ($typedNodes as $entry) {
            $allRoots = array_merge($allRoots, $entry['nodes']);
        }

        if ($allRoots === []) {
            return [
                'state' => (string) ($address['state'] ?? ''),
                'stateCode' => (string) ($address['state'] ?? ''),
                'city' => (string) ($address['city'] ?? ''),
                'cityCode' => (string) ($address['city'] ?? ''),
            ];
        }

        $provinceRoots = [];
        foreach ($typedNodes as $entry) {
            if (preg_match('/(state|province|county|region)/', (string) ($entry['type'] ?? '')) === 1) {
                $provinceRoots = array_merge($provinceRoots, $entry['nodes']);
            }
        }
        $provinceSearchRoots = $provinceRoots !== [] ? $provinceRoots : $allRoots;
        $provinceMatch = $this->findAddressNode($provinceSearchRoots, (string) ($address['state'] ?? ''));

        $explicitCityRoots = [];
        foreach ($typedNodes as $entry) {
            if (preg_match('/(city|town)/', (string) ($entry['type'] ?? '')) === 1) {
                $explicitCityRoots = array_merge($explicitCityRoots, $entry['nodes']);
            }
        }
        $citySearchRoots = is_array($provinceMatch['children'] ?? null) && ($provinceMatch['children'] ?? []) !== []
            ? $provinceMatch['children']
            : ($explicitCityRoots !== [] ? $explicitCityRoots : $allRoots);
        $cityMatch = $this->findAddressNode($citySearchRoots, (string) ($address['city'] ?? ''));

        return [
            'state' => (string) ($provinceMatch['name'] ?? $address['state'] ?? ''),
            'stateCode' => (string) ($provinceMatch['code'] ?? $provinceMatch['id'] ?? $provinceMatch['name'] ?? $address['state'] ?? ''),
            'city' => (string) ($cityMatch['name'] ?? $address['city'] ?? ''),
            'cityCode' => (string) ($cityMatch['code'] ?? $cityMatch['id'] ?? $cityMatch['name'] ?? $address['city'] ?? ''),
        ];
    }

    private function queryDsFreight(array $account, array $payload): array
    {
        return $this->callTopEndpoint($account, 'aliexpress.ds.freight.query', [
            'queryDeliveryReq' => json_encode($payload, JSON_UNESCAPED_SLASHES),
        ]);
    }

    private function normalizeAddressOptions($responseBody): array
    {
        $sellerPayload = $this->getSellerPayload($responseBody);
        $data = $this->isAssoc($sellerPayload) ? ($sellerPayload['data'] ?? null) : null;
        $entries = is_array($data)
            ? $data
            : ($this->isAssoc($data) ? [$data] : []);

        $options = [];
        foreach ($entries as $entry) {
            if (! $this->isAssoc($entry)) {
                continue;
            }

            $options[] = [
                'countryCode' => $this->getString($entry['country'] ?? null),
                'type' => $this->getString($entry['type'] ?? null),
                'childrenJson' => $this->getString($entry['children'] ?? null),
            ];
        }

        return $options;
    }

    private function parseAddressNodes($value): array
    {
        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return [];
            }

            $decoded = json_decode($trimmed, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $this->parseAddressNodes($decoded);
            }

            return [];
        }

        if (! is_array($value)) {
            return [];
        }

        if (! $this->isAssoc($value)) {
            $nodes = [];
            foreach ($value as $entry) {
                $nodes = array_merge($nodes, $this->parseAddressNodes($entry));
            }

            return $nodes;
        }

        $name = $this->getString($value['name'] ?? $value['label'] ?? $value['text'] ?? $value['display_name'] ?? null);
        $code = $this->getString($value['code'] ?? $value['value'] ?? $value['areaCode'] ?? $value['cityCode'] ?? $value['provinceCode'] ?? null);
        $id = $this->getString($value['id'] ?? $value['areaId'] ?? $value['cityId'] ?? $value['provinceId'] ?? null);
        $children = $this->parseAddressNodes($value['children'] ?? $value['childrens'] ?? $value['areas'] ?? null);

        if ($name === null && $code === null && $id === null) {
            return [];
        }

        return [[
            'name' => $name ?? $code ?? $id ?? '',
            'code' => $code,
            'id' => $id,
            'children' => $children,
        ]];
    }

    private function findAddressNode(array $nodes, string $value): ?array
    {
        $normalizedTarget = $this->normalizeComparableText($value);
        if ($normalizedTarget === '') {
            return null;
        }

        $queue = $nodes;
        while ($queue !== []) {
            $current = array_shift($queue);
            if (! is_array($current)) {
                continue;
            }

            $matches = false;
            foreach ([(string) ($current['name'] ?? ''), (string) ($current['code'] ?? ''), (string) ($current['id'] ?? '')] as $candidate) {
                if ($this->normalizeComparableText($candidate) === $normalizedTarget) {
                    $matches = true;
                    break;
                }
            }

            if ($matches) {
                return $current;
            }

            if (is_array($current['children'] ?? null)) {
                foreach ($current['children'] as $child) {
                    $queue[] = $child;
                }
            }
        }

        return null;
    }

    private function normalizeComparableText(string $value): string
    {
        $normalized = trim(mb_strtolower($value));
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? '';
        return strtr($normalized, [
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'à' => 'a', 'â' => 'a', 'ä' => 'a',
            'î' => 'i', 'ï' => 'i',
            'ô' => 'o', 'ö' => 'o',
            'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'ç' => 'c',
        ]);
    }

    private function resolveCarrierCode($freightResponseBody): ?string
    {
        $payload = $this->getSellerPayload($freightResponseBody);
        foreach ($this->collectDeliveryOptions($payload) as $option) {
            if (! is_array($option)) {
                continue;
            }

            $vendorCode = $this->getString($option['code']
                ?? $option['service_name']
                ?? $option['serviceName']
                ?? $option['logistics_service_name']
                ?? $option['logisticsServiceName']
                ?? $option['shipping_service']
                ?? $option['shippingService']
                ?? $option['carrier_code']
                ?? $option['carrierCode']
                ?? $option['company']
                ?? $option['company_name']
                ?? null);
            if ($vendorCode !== null) {
                return $vendorCode;
            }
        }

        return null;
    }

    private function resolveAlibabaCarrierCode($freightResponseBody): ?string
    {
        $payload = $this->toArray($freightResponseBody);
        foreach ($this->collectDeliveryOptions($payload) as $option) {
            if (! is_array($option)) {
                continue;
            }

            $vendorCode = $this->getString($option['vendor_code']
                ?? $option['carrier_code']
                ?? $option['carrierCode']
                ?? $option['service_provider']
                ?? $option['serviceProvider']
                ?? $option['code']
                ?? null);
            if ($vendorCode !== null) {
                return $vendorCode;
            }
        }

        return null;
    }

    private function collectDeliveryOptions($value, int $depth = 0): array
    {
        if ($depth > 6 || ! is_array($value)) {
            return [];
        }

        if (! $this->isAssoc($value)) {
            $options = [];
            foreach ($value as $entry) {
                if (is_array($entry) && $this->looksLikeDeliveryOption($entry)) {
                    $options[] = $entry;
                    continue;
                }

                $options = array_merge($options, $this->collectDeliveryOptions($entry, $depth + 1));
            }

            return $options;
        }

        $options = [];
        foreach ([
            'delivery_options',
            'deliveryOptions',
            'delivery_option_d_t_o',
            'deliveryOptionDTO',
            'delivery_option_dto',
            'logistics_service_list',
            'logisticsServiceList',
            'shipping_options',
            'shippingOptions',
            'freight_options',
            'freightOptions',
            'value',
        ] as $key) {
            if (array_key_exists($key, $value)) {
                $options = array_merge($options, $this->collectDeliveryOptions($value[$key], $depth + 1));
            }
        }

        if ($this->looksLikeDeliveryOption($value)) {
            $options[] = $value;
        }

        foreach ($value as $nested) {
            $options = array_merge($options, $this->collectDeliveryOptions($nested, $depth + 1));
        }

        return $options;
    }

    private function looksLikeDeliveryOption(array $value): bool
    {
        foreach ([
            'code',
            'service_name',
            'serviceName',
            'logistics_service_name',
            'logisticsServiceName',
            'shipping_service',
            'shippingService',
            'carrier_code',
            'carrierCode',
            'vendor_code',
            'vendorCode',
            'company',
            'company_name',
        ] as $key) {
            if ($this->getString($value[$key] ?? null) !== null) {
                return true;
            }
        }

        return false;
    }

    private function encodeOAuthState(string $accountId, string $redirectUri): string
    {
        return rawurlencode($accountId).'|'.rawurlencode($redirectUri);
    }

    public function decodeOAuthState(?string $state): ?array
    {
        if ($state === null || trim($state) === '') {
            return null;
        }

        $parts = explode('|', $state);
        $encodedAccountId = array_shift($parts);
        if ($encodedAccountId === null || $encodedAccountId === '') {
            return null;
        }

        return [
            'accountId' => rawurldecode($encodedAccountId),
            'redirectUri' => $parts !== [] ? rawurldecode(implode('|', $parts)) : null,
        ];
    }

    private function getOAuthEndpointCandidates(string $pathOrUrl, string $type): array
    {
        $normalized = trim($pathOrUrl);
        $currentIsSecurity = $this->usesSecurityTokenEndpoint($normalized, $type);
        $alternatePath = $type === 'token'
            ? ($currentIsSecurity ? '/auth/token/create' : '/auth/token/security/create')
            : ($currentIsSecurity ? '/auth/token/refresh' : '/auth/token/security/refresh');
        $alternate = $this->buildOAuthEndpointVariant($normalized, $alternatePath);

        return $alternate !== $normalized ? [$normalized, $alternate] : [$normalized];
    }

    private function usesSecurityTokenEndpoint(string $pathOrUrl, string $type): bool
    {
        $parts = parse_url($pathOrUrl);
        $path = (string) ($parts['path'] ?? $pathOrUrl);
        $normalizedPath = str_starts_with($path, '/rest/') ? substr($path, 5) : $path;

        return $type === 'token'
            ? $normalizedPath === '/auth/token/security/create'
            : $normalizedPath === '/auth/token/security/refresh';
    }

    private function buildOAuthEndpointVariant(string $pathOrUrl, string $targetPath): string
    {
        if (str_starts_with($pathOrUrl, 'http://') || str_starts_with($pathOrUrl, 'https://')) {
            $parts = parse_url($pathOrUrl);
            $scheme = $parts['scheme'] ?? 'https';
            $host = $parts['host'] ?? 'api-sg.aliexpress.com';
            $port = isset($parts['port']) ? ':'.$parts['port'] : '';
            return $scheme.'://'.$host.$port.'/rest'.$targetPath;
        }

        return '/rest'.$targetPath;
    }

    private function getOAuthResponseBody($responseBody): ?array
    {
        $normalized = $this->getSellerPayload($responseBody);
        return $this->isAssoc($normalized) ? $normalized : null;
    }

    private function getOAuthResponseCode($responseBody): ?string
    {
        $body = $this->getOAuthResponseBody($responseBody);
        $response = $this->toArray($responseBody);

        return $this->getString($body['code'] ?? $body['response_code'] ?? $body['rsp_code'] ?? $response['code'] ?? $response['rsp_code'] ?? null);
    }

    private function getOAuthResponseMessage($responseBody): ?string
    {
        $body = $this->getOAuthResponseBody($responseBody);
        $response = $this->toArray($responseBody);

        return $this->getString($body['msg'] ?? $body['message'] ?? $body['response_msg'] ?? $body['rsp_msg'] ?? $response['message'] ?? $response['msg'] ?? $response['rsp_msg'] ?? null);
    }

    private function isOAuthTokenResponseSuccessful($responseBody): bool
    {
        $body = $this->getOAuthResponseBody($responseBody);
        $accessToken = $this->getString($body['access_token'] ?? null);
        $code = strtolower(trim((string) ($this->getOAuthResponseCode($responseBody) ?? '')));

        return $accessToken !== null && ($code === '' || in_array($code, ['0', '200', 'success', 'true'], true));
    }

    private function shouldTryOAuthAlternateEndpoint($responseBody): bool
    {
        $code = strtoupper(trim((string) ($this->getOAuthResponseCode($responseBody) ?? '')));
        $message = strtolower(trim((string) ($this->getOAuthResponseMessage($responseBody) ?? '')));

        return in_array($code, ['AUTH_TYPE_UNSUPPORTED', 'INCOMPLETESIGNATURE', 'ISV.402'], true) || $message === 'creation failed';
    }

    private function mergeOAuthAccountData(array $account, array $body): array
    {
        $timestamp = now()->toIso8601String();
        $accessToken = $this->getString($body['access_token'] ?? null);
        $refreshToken = $this->getString($body['refresh_token'] ?? null);

        return [
            ...$account,
            'accountPlatform' => $this->mapOAuthAccountPlatform($body['account_platform'] ?? null) ?? ($account['accountPlatform'] ?? 'seller'),
            'accessToken' => $accessToken ?? ($account['accessToken'] ?? null),
            'refreshToken' => $refreshToken ?? ($account['refreshToken'] ?? null),
            'accessTokenExpiresAt' => isset($body['expires_in']) ? now()->addSeconds((int) $body['expires_in'])->toIso8601String() : ($account['accessTokenExpiresAt'] ?? null),
            'refreshTokenExpiresAt' => isset($body['refresh_expires_in']) ? now()->addSeconds((int) $body['refresh_expires_in'])->toIso8601String() : ($account['refreshTokenExpiresAt'] ?? null),
            'oauthCountry' => $this->getString($body['country'] ?? $body['locale'] ?? null) ?? ($account['oauthCountry'] ?? null),
            'accountId' => $this->getString($body['account_id'] ?? $body['user_id'] ?? $body['havana_id'] ?? null) ?? ($account['accountId'] ?? null),
            'accountLogin' => $this->getString($body['account'] ?? $body['user_nick'] ?? $body['user_info']['loginId'] ?? null) ?? ($account['accountLogin'] ?? null),
            'accountName' => $this->getString($body['user_nick'] ?? $body['user_info']['loginId'] ?? null) ?? ($account['accountName'] ?? null),
            'memberId' => $this->getString($body['seller_id'] ?? $body['user_id'] ?? $body['user_info']['seller_id'] ?? $body['user_info']['user_id'] ?? null) ?? ($account['memberId'] ?? null),
            'status' => 'connected',
            'isActive' => true,
            'lastAuthorizedAt' => $timestamp,
            'lastError' => null,
            'accessTokenHint' => $accessToken !== null ? substr($accessToken, 0, 10).'...' : ($account['accessTokenHint'] ?? null),
            'updatedAt' => $timestamp,
        ];
    }

    private function mapOAuthAccountPlatform($value): ?string
    {
        $normalized = strtolower(trim((string) $value));
        if (str_contains($normalized, 'buyer')) {
            return 'buyer';
        }
        if (str_contains($normalized, 'isv')) {
            return 'isv';
        }
        if (str_contains($normalized, 'seller')) {
            return 'seller';
        }

        return null;
    }

    private function tokenExpiringSoon($value): bool
    {
        $timestamp = strtotime((string) $value);
        return $timestamp !== false && $timestamp <= (time() + 300);
    }

    private function extractOperationMessage($responseBody): ?string
    {
        $response = $this->toArray($responseBody);
        $respResult = $this->toArray($response['resp_result'] ?? null);
        $envelope = $this->isAssoc($response['result'] ?? null)
            ? $response['result']
            : ($this->isAssoc($respResult['result'] ?? null) ? $respResult['result'] : $response);

        return $this->getString($envelope['message'] ?? $envelope['msg'] ?? $envelope['error_msg'] ?? $envelope['response_msg'] ?? $respResult['resp_msg'] ?? $response['message'] ?? $response['msg'] ?? null);
    }

    private function extractOperationCode($responseBody): ?string
    {
        $response = $this->toArray($responseBody);
        $respResult = $this->toArray($response['resp_result'] ?? null);
        $envelope = $this->isAssoc($response['result'] ?? null)
            ? $response['result']
            : ($this->isAssoc($respResult['result'] ?? null) ? $respResult['result'] : $response);

        return $this->getString($envelope['msg_code'] ?? $envelope['error_code'] ?? $envelope['code'] ?? $envelope['response_code'] ?? $respResult['resp_code'] ?? $response['code'] ?? null);
    }

    private function extractTradeId($responseBody): ?string
    {
        $response = $this->toArray($responseBody);
        $envelope = $this->isAssoc($response['result'] ?? null) ? $response['result'] : $response;
        $value = $this->isAssoc($envelope['value'] ?? null) ? $envelope['value'] : ($this->isAssoc($response['value'] ?? null) ? $response['value'] : []);
        $data = $this->isAssoc($envelope['data'] ?? null) ? $envelope['data'] : ($this->isAssoc($response['data'] ?? null) ? $response['data'] : []);
        $orderList = $this->isAssoc($envelope['order_list'] ?? null) ? $envelope['order_list'] : ($this->isAssoc($response['order_list'] ?? null) ? $response['order_list'] : []);
        $orderNumbers = is_array($orderList['number'] ?? null) ? $orderList['number'] : (is_array($orderList['order_ids'] ?? null) ? $orderList['order_ids'] : []);
        $firstOrderNumber = $orderNumbers[0] ?? null;

        return $this->getString($envelope['trade_id'] ?? $response['trade_id'] ?? $data['trade_id'] ?? $value['trade_id'] ?? $value['order_id'] ?? $data['order_id'] ?? $firstOrderNumber ?? null);
    }

    private function isSuccessfulOperation($responseBody): bool
    {
        $code = strtolower(trim((string) ($this->extractOperationCode($responseBody) ?? '')));
        if ($code !== '' && ! in_array($code, ['0', '200', 'null', 'success', 'true'], true) && $this->extractTradeId($responseBody) === null) {
            return false;
        }

        return true;
    }

    private function describeExactProductResponseShape($responseBody): string
    {
        $result = $this->getSellerPayload($responseBody);
        $baseInfo = $this->toArray($result['ae_item_base_info_dto'] ?? null);
        $skuInfo = is_array($result['ae_item_sku_info_dtos'] ?? null) ? $result['ae_item_sku_info_dtos'] : (is_array($result['sku_info'] ?? null) ? $result['sku_info'] : []);
        if ($baseInfo === []) {
            return 'result_without_base_info';
        }
        if ($skuInfo === []) {
            return 'result_without_skus';
        }
        return 'result_with_base_info_and_skus';
    }

    private function collectObjectNodes($value, int $depth = 0): array
    {
        if ($depth > 5 || ! is_array($value)) {
            return [];
        }

        $nodes = $this->isAssoc($value) ? [$value] : [];
        foreach ($value as $entry) {
            $nodes = array_merge($nodes, $this->collectObjectNodes($entry, $depth + 1));
        }

        return $nodes;
    }

    private function collectStrings($value): array
    {
        if ($value === null) {
            return [];
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed !== '' ? [$trimmed] : [];
        }

        if (is_array($value)) {
            $strings = [];
            foreach ($value as $entry) {
                $strings = array_merge($strings, $this->collectStrings($entry));
            }
            return $strings;
        }

        return [];
    }

    private function getString($value): ?string
    {
        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed !== '' ? $trimmed : null;
        }

        if (is_numeric($value)) {
            return (string) $value;
        }

        return null;
    }

    private function toFloat($value): float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        $normalized = preg_replace('/[^0-9.\-]/', '', (string) $value);
        return is_numeric($normalized) ? (float) $normalized : 0.0;
    }

    private function toInt($value): int
    {
        if (is_numeric($value)) {
            return (int) round((float) $value);
        }

        $normalized = preg_replace('/[^0-9\-]/', '', (string) $value);
        return is_numeric($normalized) ? (int) $normalized : 0;
    }

    private function toArray($value): array
    {
        return is_array($value) ? $value : [];
    }

    private function slugify(string $value): string
    {
        $slug = Str::slug($value);
        return $slug !== '' ? $slug : 'alibaba-product';
    }

    private function isAssoc($value): bool
    {
        return is_array($value) && ! array_is_list($value);
    }

    private function extractWeightGrams($value, int $depth = 0, ?string $keyHint = null): ?int
    {
        if ($depth > 5 || $value === null) {
            return null;
        }

        $direct = $this->parseWeightToGrams($value, $keyHint);
        if ($direct !== null && $direct > 0) {
            return $direct;
        }

        if (is_array($value)) {
            foreach ($value as $nestedKey => $nestedValue) {
                $candidate = $this->extractWeightGrams($nestedValue, $depth + 1, is_string($nestedKey) ? $nestedKey : $keyHint);
                if ($candidate !== null && $candidate > 0) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    private function parseWeightToGrams($value, ?string $keyHint = null): ?int
    {
        if (is_numeric($value)) {
            $number = (float) $value;
            if ($number <= 0 || ! $this->isWeightKeyHint($keyHint)) {
                return null;
            }

            return (int) round($number < 10 ? $number * 1000 : $number);
        }

        if (! is_string($value)) {
            return null;
        }

        $normalized = trim(strtolower($value));
        if ($normalized === '') {
            return null;
        }

        if (preg_match('/(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilograms)\b/i', $normalized, $matches) === 1) {
            return (int) round((float) str_replace(',', '.', $matches[1]) * 1000);
        }

        if (preg_match('/(\d+(?:[.,]\d+)?)\s*(g|gram|grams)\b/i', $normalized, $matches) === 1) {
            return (int) round((float) str_replace(',', '.', $matches[1]));
        }

        if ($this->isWeightKeyHint($keyHint) && preg_match('/\d+(?:[.,]\d+)?/', $normalized, $matches) === 1) {
            $number = (float) str_replace(',', '.', $matches[0]);
            return (int) round($number < 10 ? $number * 1000 : $number);
        }

        return null;
    }

    private function isWeightKeyHint(?string $keyHint): bool
    {
        return is_string($keyHint) && preg_match('/weight|gross[_ -]?weight|net[_ -]?weight|package[_ -]?weight|shipping[_ -]?weight|item[_ -]?weight|product[_ -]?weight|parcel[_ -]?weight|poids|kg|gram/i', $keyHint) === 1;
    }

    private function extractPackageDimensionsCm($value, int $depth = 0): ?array
    {
        if ($depth > 5 || ! is_array($value)) {
            return null;
        }

        $length = $this->normalizeDimensionCm($value['package_length'] ?? $value['length'] ?? $value['lengthCm'] ?? $value['packageLength'] ?? $value['product_length'] ?? $value['item_length'] ?? null);
        $width = $this->normalizeDimensionCm($value['package_width'] ?? $value['width'] ?? $value['widthCm'] ?? $value['packageWidth'] ?? $value['product_width'] ?? $value['item_width'] ?? null);
        $height = $this->normalizeDimensionCm($value['package_height'] ?? $value['height'] ?? $value['heightCm'] ?? $value['packageHeight'] ?? $value['product_height'] ?? $value['item_height'] ?? null);

        if ($length !== null && $width !== null && $height !== null) {
            return [
                'lengthCm' => $length,
                'widthCm' => $width,
                'heightCm' => $height,
            ];
        }

        foreach (['package_size', 'package_dimension', 'package_dimensions', 'product_dimensions', 'dimensions', 'dimension', 'size'] as $dimensionKey) {
            $candidate = $this->parsePackagingDimensions($this->getString($value[$dimensionKey] ?? null));
            if ($candidate !== null) {
                return $candidate;
            }
        }

        foreach ($value as $nestedValue) {
            $candidate = $this->extractPackageDimensionsCm($nestedValue, $depth + 1);
            if ($candidate !== null) {
                return $candidate;
            }
        }

        return null;
    }

    private function normalizeDimensionCm($value): ?float
    {
        $number = $this->toFloat($value);
        return $number > 0 ? round($number, 2) : null;
    }

    private function parsePackagingDimensions(?string $packaging): ?array
    {
        if (! is_string($packaging) || trim($packaging) === '') {
            return null;
        }

        if (preg_match('/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm/i', $packaging, $matches) !== 1) {
            return null;
        }

        return [
            'lengthCm' => round((float) str_replace(',', '.', $matches[1]), 2),
            'widthCm' => round((float) str_replace(',', '.', $matches[2]), 2),
            'heightCm' => round((float) str_replace(',', '.', $matches[3]), 2),
        ];
    }

    private function formatLotCbm(?array $packageDimensions): string
    {
        if (! is_array($packageDimensions)) {
            return '0.0000';
        }

        $length = (float) ($packageDimensions['lengthCm'] ?? 0);
        $width = (float) ($packageDimensions['widthCm'] ?? 0);
        $height = (float) ($packageDimensions['heightCm'] ?? 0);
        if ($length <= 0 || $width <= 0 || $height <= 0) {
            return '0.0000';
        }

        return number_format(($length * $width * $height) / 1000000, 4, '.', '');
    }
}
