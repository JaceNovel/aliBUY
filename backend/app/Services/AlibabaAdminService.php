<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class AlibabaAdminService
{
    private const PANEL_SLUGS = [
        'dashboard',
        'accounts',
        'import-catalog',
        'countries',
        'addresses',
        'mappings',
        'requests',
        'lots',
        'sourcing-lots',
        'receptions',
    ];

    public function __construct(
        protected AlibabaOpenPlatformService $openPlatform,
    ) {
    }

    public function assertAdmin($user): void
    {
        abort_unless($user && $user->hasAdminAccess(), 403, 'Acces refuse.');
    }

    public function buildDashboard(?string $panel = null): array
    {
        $normalizedPanel = $this->normalizePanel($panel);
        $mappings = $this->normalizeRecordList($this->readJsonArray('catalog-mapping.json'));
        $importJobs = $this->normalizeRecordList($this->readJsonArray('alibaba-import-jobs.json'));
        $importedProducts = $this->normalizeRecordList($this->readJsonArray('alibaba-imported-products.json'));
        $purchaseOrders = $this->normalizeRecordList($this->readJsonArray('alibaba-purchase-orders.json'));
        $supplierAccounts = $this->sanitizeSupplierAccounts($this->normalizeRecordList($this->readJsonArray('alibaba-supplier-accounts.json')));
        $countries = $this->normalizeRecordList($this->readJsonArray('alibaba-country-profiles.json'));
        $addresses = $this->normalizeRecordList($this->readJsonArray('alibaba-reception-addresses.json'));
        $receptions = $this->normalizeRecordList($this->readJsonArray('alibaba-receptions.json'));

        return [
            'panel' => $normalizedPanel,
            'mappings' => $mappings,
            'importJobs' => $importJobs,
            'importedProducts' => $importedProducts,
            'purchaseOrders' => $purchaseOrders,
            'supplierAccounts' => $supplierAccounts,
            'countries' => $countries,
            'addresses' => $addresses,
            'receptions' => $receptions,
            'storage' => $this->buildStorageState(),
            'stats' => [
                'importedCount' => count($importedProducts),
                'publishedCount' => count(array_filter($importedProducts, fn ($item) => ($item['publishedToSite'] ?? false) === true)),
                'pendingPayments' => count(array_filter($purchaseOrders, fn ($order) => in_array(($order['paymentStatus'] ?? null), ['pending', 'pay_url_generated'], true))),
                'paidOrders' => count(array_filter($purchaseOrders, fn ($order) => ($order['paymentStatus'] ?? null) === 'paid')),
            ],
        ];
    }

    public function search(array $input): array
    {
        $account = $this->resolveLiveAccount($this->stringOrNull($input['supplierAccountId'] ?? null), true);
        if ($account !== null) {
            $result = $this->openPlatform->search($account, $input);
            $this->persistResolvedLiveAccount($result['account']);
            $payload = $result['payload'];
            if (isset($payload['message'])) {
                throw new RuntimeException((string) $payload['message']);
            }

            $this->appendLog('catalog-search', '/eco/buyer/product/search -> /eco/buyer/product/description', 'success', $input, [
                'query' => trim((string) ($input['query'] ?? '')),
                'totalCount' => $payload['totalCount'] ?? 0,
                'pageIndex' => $payload['pageIndex'] ?? 1,
                'pageSize' => $payload['pageSize'] ?? 12,
                'live' => true,
            ]);

            return $payload;
        }

        $query = trim((string) ($input['query'] ?? ''));
        $pageSize = max(1, min(40, (int) ($input['pageSize'] ?? 20)));
        $pageIndex = max(1, (int) ($input['pageIndex'] ?? 1));
        $pool = $this->buildSearchPool();

        $filtered = array_values(array_filter($pool, function (array $item) use ($query): bool {
            if ($query === '') {
                return true;
            }

            $haystack = mb_strtolower(implode(' ', array_filter([
                $item['productId'] ?? '',
                $item['title'] ?? '',
                $item['itemUrl'] ?? '',
                $item['categoryId'] ?? '',
                $item['product']['title'] ?? '',
                $item['product']['shortTitle'] ?? '',
                $item['product']['supplierName'] ?? '',
                implode(' ', array_map(fn ($keyword) => (string) $keyword, $item['product']['keywords'] ?? [])),
            ])));

            return str_contains($haystack, mb_strtolower($query));
        }));

        $totalCount = count($filtered);
        $offset = ($pageIndex - 1) * $pageSize;
        $pageItems = array_slice($filtered, $offset, $pageSize);

        $this->appendLog('catalog-search', 'internal/alibaba/search', 'success', $input, [
            'query' => $query,
            'totalCount' => $totalCount,
            'pageIndex' => $pageIndex,
            'pageSize' => $pageSize,
        ]);

        return [
            'products' => array_values($pageItems),
            'totalCount' => $totalCount,
            'pageIndex' => $pageIndex,
            'pageSize' => $pageSize,
            'requestId' => (string) Str::uuid(),
        ];
    }

    public function fetchRemote(array $input): array
    {
        $account = $this->resolveLiveAccount($this->stringOrNull($input['supplierAccountId'] ?? null), true);
        if ($account !== null) {
            $result = $this->openPlatform->fetchRemote($account, $input);
            $this->persistResolvedLiveAccount($result['account']);
            $payload = $result['payload'];
            $this->appendLog('catalog-fetch-remote', '/eco/buyer/product/description', 'success', $input, [
                'sourceProductId' => $payload['sourceProductId'] ?? null,
                'live' => true,
            ]);
            return $payload;
        }

        $query = trim((string) ($input['query'] ?? ''));
        if ($query === '') {
            throw new RuntimeException("Import manuel impossible: saisis un External product ID fournisseur ou un lien produit fournisseur.");
        }

        $sourceProductId = $this->extractSourceProductId($query);
        $importedProducts = $this->readJsonArray('alibaba-imported-products.json');
        $match = collect($importedProducts)->first(function ($item) use ($sourceProductId, $query) {
            if (! is_array($item)) {
                return false;
            }

            return ($sourceProductId !== '' && (string) ($item['sourceProductId'] ?? '') === $sourceProductId)
                || mb_strtolower((string) ($item['title'] ?? '')) === mb_strtolower($query);
        });

        if (is_array($match)) {
            $previewProduct = $this->toPreviewProductFromImported($match);
            $debug = [
                'externalProductId' => $previewProduct['sourceProductId'],
                'shipToCountry' => (string) ($input['destinationCountry'] ?? 'FR'),
                'targetCurrency' => (string) ($input['targetCurrency'] ?? 'USD'),
                'targetLanguage' => (string) ($input['targetLanguage'] ?? 'fr_FR'),
                'resolvedRemoteMode' => 'stored_local_snapshot',
                'fallbackUsed' => true,
                'responseShape' => 'stored_snapshot',
                'attempts' => [[
                    'endpoint' => 'stored.imported-product',
                    'shipToCountry' => (string) ($input['destinationCountry'] ?? 'FR'),
                    'targetCurrency' => (string) ($input['targetCurrency'] ?? 'USD'),
                    'targetLanguage' => (string) ($input['targetLanguage'] ?? 'fr_FR'),
                    'ok' => true,
                    'responseShape' => 'stored_snapshot',
                    'mappingStatus' => 'resolved',
                ]],
            ];

            $this->appendLog('catalog-fetch-remote', 'internal/alibaba/fetch-remote', 'success', $input, [
                'sourceProductId' => $previewProduct['sourceProductId'],
            ]);

            return [
                'ok' => true,
                'endpoint' => 'stored.imported-product',
                'sourceProductId' => $previewProduct['sourceProductId'],
                'product' => $previewProduct,
                'debug' => $debug,
            ];
        }

        $debug = [
            'externalProductId' => $sourceProductId !== '' ? $sourceProductId : null,
            'shipToCountry' => (string) ($input['destinationCountry'] ?? 'FR'),
            'targetCurrency' => (string) ($input['targetCurrency'] ?? 'USD'),
            'targetLanguage' => (string) ($input['targetLanguage'] ?? 'fr_FR'),
            'responseShape' => 'empty_payload',
            'attempts' => [[
                'endpoint' => 'stored.imported-product',
                'shipToCountry' => (string) ($input['destinationCountry'] ?? 'FR'),
                'targetCurrency' => (string) ($input['targetCurrency'] ?? 'USD'),
                'targetLanguage' => (string) ($input['targetLanguage'] ?? 'fr_FR'),
                'ok' => false,
                'responseShape' => 'empty_payload',
                'mappingStatus' => 'not_found',
            ]],
        ];

        $this->appendLog('catalog-fetch-remote', 'internal/alibaba/fetch-remote', 'failed', $input, $debug);

        throw new RuntimeException("Produit fournisseur introuvable dans le stockage backend actuel. L'import exact live n'est pas encore porte en PHP; ajoute d'abord un snapshot via le flux fournisseur ou importe depuis une source deja connue.");
    }

    public function probe(array $input): array
    {
        $account = $this->resolveLiveAccount($this->stringOrNull($input['supplierAccountId'] ?? null), true);
        if ($account === null) {
            throw new RuntimeException("Aucun compte fournisseur connecte n'est disponible pour executer un appel fournisseur live.");
        }

        $result = $this->openPlatform->probeDsApi($account, $input);
        $this->persistResolvedLiveAccount($result['account']);

        $apiResult = $result['result'];
        $this->appendLog(
            'catalog-probe',
            (string) ($apiResult['endpoint'] ?? ($input['operation'] ?? 'aliexpress.ds.unknown')),
            ($apiResult['ok'] ?? false) ? 'success' : 'failed',
            $input,
            [
                'status' => $apiResult['status'] ?? null,
                'requestBody' => $apiResult['requestBody'] ?? null,
                'responseBody' => $apiResult['responseBody'] ?? null,
            ]
        );

        return [
            'ok' => (bool) ($apiResult['ok'] ?? false),
            'endpoint' => (string) ($apiResult['endpoint'] ?? ''),
            'status' => (int) ($apiResult['status'] ?? 0),
            'requestBody' => $apiResult['requestBody'] ?? [],
            'responseBody' => $apiResult['responseBody'] ?? null,
        ];
    }

    public function import(array $input): array
    {
        $query = trim((string) ($input['query'] ?? ''));
        if ($query === '') {
            throw new RuntimeException("Requete d'import fournisseur manquante.");
        }

        $existing = $this->readJsonArray('alibaba-imported-products.json');
        $purgedCount = 0;
        if (($input['resetImportedProducts'] ?? false) === true) {
            $purgedCount = count($existing);
            $existing = [];
        }

        $sources = $this->resolveImportSources($input, $existing);
        if ($sources === []) {
            throw new RuntimeException("Aucun produit exploitable n'a ete trouve pour cet import Laravel. Le flux live fournisseur n'est pas encore porte en PHP; fournis un prefetchedProduct ou pars d'un snapshot deja stocke.");
        }

        $targetImportCount = max(1, (int) ($input['limit'] ?? count($sources)));
        $now = $this->nowIso();
        $products = array_slice($sources, 0, $targetImportCount);
        $created = [];
        $skippedExistingCount = 0;

        foreach ($products as $source) {
            $sourceProductId = (string) ($source['sourceProductId'] ?? $source['productId'] ?? '');
            if ($sourceProductId !== '' && collect($existing)->contains(fn ($item) => is_array($item) && (string) ($item['sourceProductId'] ?? '') === $sourceProductId)) {
                $skippedExistingCount++;
                continue;
            }

            $record = $this->buildImportedProductRecord($source, $input, $now);
            $existing[] = $record;
            $created[] = $record;
        }

        if (($input['autoPublish'] ?? false) === true && $created !== []) {
            $this->publishImportedProducts(array_map(fn ($item) => (string) $item['id'], $created), $existing);
            $existing = $this->readJsonArray('alibaba-imported-products.json');
            $createdIds = array_flip(array_map(fn ($item) => (string) $item['id'], $created));
            $created = array_values(array_filter($existing, fn ($item) => is_array($item) && isset($createdIds[(string) ($item['id'] ?? '')])));
        } else {
            $this->writeJsonArray('alibaba-imported-products.json', $existing);
        }

        $importJobs = $this->readJsonArray('alibaba-import-jobs.json');
        $importJobs[] = [
            'id' => (string) Str::uuid(),
            'query' => $query,
            'limit' => $targetImportCount,
            'fulfillmentChannel' => (string) ($input['fulfillmentChannel'] ?? 'crossborder'),
            'autoPublish' => ($input['autoPublish'] ?? false) === true,
            'status' => 'completed',
            'importedCount' => count($created),
            'createdAt' => $now,
            'updatedAt' => $now,
            'productIds' => array_values(array_map(fn ($item) => (string) $item['id'], $created)),
        ];
        $this->writeJsonArray('alibaba-import-jobs.json', $importJobs);

        $response = [
            'products' => array_values($created),
            'targetImportCount' => $targetImportCount,
            'purgedCount' => $purgedCount,
            'skippedExistingCount' => $skippedExistingCount,
            'freeDealProductSlugs' => [],
        ];

        $this->appendLog('catalog-import', 'internal/alibaba/import', 'success', $input, [
            'createdCount' => count($created),
            'purgedCount' => $purgedCount,
            'skippedExistingCount' => $skippedExistingCount,
        ]);

        return $response;
    }

    public function deleteImportedProducts(?string $importedProductId = null, ?string $sourceProductId = null, bool $siteReset = false): array
    {
        $products = $this->readJsonArray('alibaba-imported-products.json');

        if ($importedProductId === null) {
            $deletedCount = count($products);
            $this->writeJsonArray('alibaba-imported-products.json', []);

            $response = ['deletedCount' => $deletedCount];

            if ($siteReset) {
                $response = [
                    ...$response,
                    ...$this->resetAliExpressSiteCatalogState(),
                ];
            }

            return $response;
        }

        $before = count($products);
        $remaining = array_values(array_filter($products, function ($item) use ($importedProductId, $sourceProductId): bool {
            if (! is_array($item)) {
                return true;
            }

            if ((string) ($item['id'] ?? '') !== $importedProductId) {
                return true;
            }

            if ($sourceProductId !== null && $sourceProductId !== '' && (string) ($item['sourceProductId'] ?? '') !== $sourceProductId) {
                return true;
            }

            return false;
        }));

        $deletedCount = $before - count($remaining);
        if ($deletedCount === 0) {
            throw new RuntimeException('Article importe introuvable.');
        }

        $this->writeJsonArray('alibaba-imported-products.json', $remaining);
        $deletedCatalogProducts = $this->deleteCatalogProductsForImportedItem($products, $importedProductId, $sourceProductId);

        return ['deleted' => true, 'deletedCount' => $deletedCount, 'deletedCatalogProducts' => $deletedCatalogProducts];
    }

    private function resetAliExpressSiteCatalogState(): array
    {
        $deletedCatalogProducts = 0;
        $catalogWarning = null;

        try {
            $deletedCatalogProducts = Product::query()
                ->whereIn('source_provider', ['aliexpress', 'alibaba'])
                ->delete();
        } catch (Throwable $exception) {
            $catalogWarning = 'Catalogue SQL non purge localement. Verifie la connexion base de donnees puis relance la purge site.';
        }

        $this->writeJsonArray('alibaba-import-jobs.json', []);
        $this->writeJsonArray('alibaba-purchase-orders.json', []);
        $this->writeJsonArray('catalog-mapping.json', []);
        $this->writeJsonArray('alibaba-receptions.json', []);

        return [
            'deletedCatalogProducts' => $deletedCatalogProducts,
            'siteConfigReset' => $this->resetSiteConfigReferences(),
            ...(is_string($catalogWarning) ? ['warningMessage' => $catalogWarning] : []),
        ];
    }

    private function deleteCatalogProductsForImportedItem(array $products, string $importedProductId, ?string $sourceProductId): int
    {
        $importedProduct = collect($products)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $importedProductId);
        $sourceId = trim((string) ($sourceProductId ?? (is_array($importedProduct) ? ($importedProduct['sourceProductId'] ?? '') : '')));
        $slug = trim((string) (is_array($importedProduct) ? ($importedProduct['slug'] ?? '') : ''));
        if ($sourceId === '' && $slug === '') {
            return 0;
        }

        try {
            return Product::query()
                ->whereIn('source_provider', ['aliexpress', 'alibaba'])
                ->where(function ($query) use ($sourceId, $slug): void {
                    if ($sourceId !== '') {
                        $query->where('source_product_id', $sourceId);
                    }
                    if ($slug !== '') {
                        $sourceId !== '' ? $query->orWhere('slug', $slug) : $query->where('slug', $slug);
                    }
                })
                ->delete();
        } catch (Throwable) {
            return 0;
        }
    }

    private function resetSiteConfigReferences(): array
    {
        $freeDealPath = base_path('data/site/free-deal-config.json');
        $modePromotionsPath = base_path('data/site/mode-promotions.json');

        $freeDealReset = false;

        $modePromotionsReset = false;
        if (File::exists($modePromotionsPath)) {
            $payload = json_decode((string) File::get($modePromotionsPath), true);
            if (is_array($payload)) {
                foreach ([
                    'groupedOfferSlugs',
                    'dailyDealSlugs',
                    'premiumSelectionSlugs',
                    'choiceDealSlugs',
                    'trendPromoSlugs',
                    'flashRushSlugs',
                    'finalDropSlugs',
                ] as $key) {
                    $payload[$key] = [];
                }

                if (is_array($payload['heroSlides'] ?? null)) {
                    $payload['heroSlides'] = array_map(function ($slide) {
                        if (! is_array($slide)) {
                            return $slide;
                        }

                        $slide['spotlightProductSlug'] = '';
                        return $slide;
                    }, $payload['heroSlides']);
                }

                $payload['updatedAt'] = $this->nowIso();
                File::put($modePromotionsPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).PHP_EOL);
                $modePromotionsReset = true;
            }
        }

        return [
            'freeDealConfigCleared' => $freeDealReset,
            'modePromotionsCleared' => $modePromotionsReset,
        ];
    }

    public function reenrichImportedProduct(string $importedProductId): array
    {
        $products = $this->readJsonArray('alibaba-imported-products.json');
        $updated = false;
        $record = null;

        foreach ($products as &$item) {
            if (! is_array($item) || (string) ($item['id'] ?? '') !== $importedProductId) {
                continue;
            }

            $item['updatedAt'] = $this->nowIso();
            $item['rawPayload']['reenrichedAt'] = $item['updatedAt'];
            $record = $item;
            $updated = true;
            break;
        }
        unset($item);

        if (! $updated || ! is_array($record)) {
            throw new RuntimeException('Article importe introuvable pour le reenrichissement.');
        }

        $this->writeJsonArray('alibaba-imported-products.json', $products);
        $this->appendLog('catalog-import-reenrich', 'internal/imported-products/reenrich', 'success', ['importedProductId' => $importedProductId], $record);

        return ['product' => $record];
    }

    public function reenrichAllImportedProducts(): array
    {
        $products = $this->readJsonArray('alibaba-imported-products.json');
        $updatedCount = 0;
        $now = $this->nowIso();

        foreach ($products as &$item) {
            if (! is_array($item)) {
                continue;
            }

            $item['updatedAt'] = $now;
            $item['rawPayload']['reenrichedAt'] = $now;
            $updatedCount++;
        }
        unset($item);

        $this->writeJsonArray('alibaba-imported-products.json', $products);
        $this->appendLog('catalog-import-reenrich-all', 'internal/imported-products/reenrich-all', 'success', ['productCount' => count($products)], [
            'productCount' => count($products),
            'updatedCount' => $updatedCount,
            'failedCount' => 0,
            'failedProducts' => [],
        ]);

        return [
            'updatedCount' => $updatedCount,
            'failedCount' => 0,
        ];
    }

    public function saveSupplierAccount(array $input): array
    {
        if (($input['action'] ?? null) === 'delete') {
            return $this->deleteSupplierAccount((string) ($input['id'] ?? ''));
        }

        $accounts = $this->readJsonArray('alibaba-supplier-accounts.json');
        $id = trim((string) ($input['id'] ?? '')) ?: (string) Str::uuid();
        $existing = collect($accounts)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $id);
        $now = $this->nowIso();

        $provider = (string) ($input['provider'] ?? 'alibaba');
        $defaultAuthorizeUrl = 'https://openapi-auth.alibaba.com/oauth/authorize';
        $defaultTokenUrl = 'https://openapi-api.alibaba.com/rest/auth/token/create';
        $defaultRefreshUrl = 'https://openapi-api.alibaba.com/rest/auth/token/refresh';
        $defaultApiBaseUrl = 'https://openapi-api.alibaba.com';

        $account = [
            'id' => $id,
            'name' => $this->stringOrFallback($input['name'] ?? null, is_array($existing) ? ($existing['name'] ?? '') : ''),
            'email' => $this->stringOrFallback($input['email'] ?? null, is_array($existing) ? ($existing['email'] ?? '') : ''),
            'memberId' => $this->stringOrNull($input['memberId'] ?? (is_array($existing) ? ($existing['memberId'] ?? null) : null)),
            'resourceOwner' => $this->stringOrNull($input['resourceOwner'] ?? (is_array($existing) ? ($existing['resourceOwner'] ?? null) : null)),
            'appKey' => $this->stringOrNull($input['appKey'] ?? (is_array($existing) ? ($existing['appKey'] ?? null) : null)),
            'appSecret' => $this->stringOrFallback($input['appSecret'] ?? null, is_array($existing) ? ($existing['appSecret'] ?? '') : ''),
            'authorizeUrl' => $this->stringOrFallback($input['authorizeUrl'] ?? null, is_array($existing) ? ($existing['authorizeUrl'] ?? $defaultAuthorizeUrl) : $defaultAuthorizeUrl),
            'tokenUrl' => $this->stringOrFallback($input['tokenUrl'] ?? null, is_array($existing) ? ($existing['tokenUrl'] ?? $defaultTokenUrl) : $defaultTokenUrl),
            'refreshUrl' => $this->stringOrFallback($input['refreshUrl'] ?? null, is_array($existing) ? ($existing['refreshUrl'] ?? $defaultRefreshUrl) : $defaultRefreshUrl),
            'apiBaseUrl' => $this->stringOrFallback($input['apiBaseUrl'] ?? null, is_array($existing) ? ($existing['apiBaseUrl'] ?? $defaultApiBaseUrl) : $defaultApiBaseUrl),
            'provider' => $provider,
            'accountPlatform' => $this->stringOrFallback($input['accountPlatform'] ?? null, is_array($existing) ? ($existing['accountPlatform'] ?? 'seller') : 'seller'),
            'countryCode' => strtoupper($this->stringOrFallback($input['countryCode'] ?? null, is_array($existing) ? ($existing['countryCode'] ?? 'FR') : 'FR')),
            'defaultDispatchLocation' => strtoupper($this->stringOrFallback($input['defaultDispatchLocation'] ?? null, is_array($existing) ? ($existing['defaultDispatchLocation'] ?? 'CN') : 'CN')),
            'status' => $this->stringOrFallback($input['status'] ?? null, is_array($existing) ? ($existing['status'] ?? 'needs_auth') : 'needs_auth'),
            'isActive' => ($input['isActive'] ?? (is_array($existing) ? ($existing['isActive'] ?? true) : true)) === true || ($input['isActive'] ?? null) === 'true',
            'accessTokenHint' => $this->stringOrNull($input['accessTokenHint'] ?? (is_array($existing) ? ($existing['accessTokenHint'] ?? null) : null)),
            'accessToken' => is_array($existing) ? ($existing['accessToken'] ?? null) : null,
            'refreshToken' => is_array($existing) ? ($existing['refreshToken'] ?? null) : null,
            'accessTokenExpiresAt' => is_array($existing) ? ($existing['accessTokenExpiresAt'] ?? null) : null,
            'refreshTokenExpiresAt' => is_array($existing) ? ($existing['refreshTokenExpiresAt'] ?? null) : null,
            'accountId' => is_array($existing) ? ($existing['accountId'] ?? null) : null,
            'accountLogin' => is_array($existing) ? ($existing['accountLogin'] ?? null) : null,
            'accountName' => is_array($existing) ? ($existing['accountName'] ?? null) : null,
            'oauthCountry' => is_array($existing) ? ($existing['oauthCountry'] ?? null) : null,
            'lastAuthorizedAt' => is_array($existing) ? ($existing['lastAuthorizedAt'] ?? null) : null,
            'lastError' => is_array($existing) ? ($existing['lastError'] ?? null) : null,
            'createdAt' => is_array($existing) ? ($existing['createdAt'] ?? $now) : $now,
            'updatedAt' => $now,
        ];

        $accounts = array_values(array_filter($accounts, fn ($item) => ! is_array($item) || (string) ($item['id'] ?? '') !== $id));
        if (($account['isActive'] ?? false) === true) {
            foreach ($accounts as &$entry) {
                if (is_array($entry)) {
                    $entry['isActive'] = false;
                    $entry['updatedAt'] = $now;
                }
            }
            unset($entry);
        }

        $accounts[] = $account;
        $this->writeJsonArray('alibaba-supplier-accounts.json', $accounts);

        return [
            'account' => $this->sanitizeSupplierAccounts([$account])[0],
        ];
    }

    public function deleteSupplierAccount(string $accountId): array
    {
        if ($accountId === '') {
            throw new RuntimeException('Compte fournisseur introuvable.');
        }

        $accounts = $this->readJsonArray('alibaba-supplier-accounts.json');
        $before = count($accounts);
        $remaining = array_values(array_filter($accounts, fn ($item) => ! is_array($item) || (string) ($item['id'] ?? '') !== $accountId));
        if ($before === count($remaining)) {
            throw new RuntimeException('Compte fournisseur introuvable.');
        }

        $this->writeJsonArray('alibaba-supplier-accounts.json', $remaining);

        return ['deleted' => true];
    }

    public function oauthStartRedirectUrl(array $input): string
    {
        $origin = rtrim((string) ($input['origin'] ?? config('app.url', '')), '/');
        $provider = (string) ($input['provider'] ?? 'alibaba');
        $adminPath = '/admin/alibaba-sourcing/accounts';
        $target = $origin !== '' ? $origin.$adminPath : $adminPath;
        $requestedId = trim((string) ($input['id'] ?? ''));

        if (($input['id'] ?? null) !== null || ($input['name'] ?? null) !== null || ($input['appKey'] ?? null) !== null) {
            $saved = $this->saveSupplierAccount($input);
            $savedAccount = is_array($saved['account'] ?? null) ? $saved['account'] : null;
            if ($requestedId === '' && is_array($savedAccount)) {
                $requestedId = trim((string) ($savedAccount['id'] ?? ''));
            }
        }

        $accounts = $this->readJsonArray('alibaba-supplier-accounts.json');
        $account = collect($accounts)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $requestedId);
        if (! is_array($account)) {
            throw new RuntimeException('Compte fournisseur introuvable pour OAuth.');
        }

        $callbackUrl = rtrim((string) config('app.url', 'https://api.afripay.space'), '/').'/api/admin/alibaba/supplier-accounts/oauth/callback';

        return $this->openPlatform->buildAuthorizationUrl($account, $callbackUrl, $target);
    }

    public function handleOAuthCallback(?string $code, ?string $state): string
    {
        $decodedState = $this->openPlatform->decodeOAuthState($state);
        $redirectTarget = is_array($decodedState) && is_string($decodedState['redirectUri'] ?? null) && trim((string) $decodedState['redirectUri']) !== ''
            ? trim((string) $decodedState['redirectUri'])
            : rtrim((string) config('app.frontend_url', config('app.url', 'https://afripay.space')), '/').'/admin/alibaba-sourcing/accounts';

        if (! is_array($decodedState) || trim((string) ($decodedState['accountId'] ?? '')) === '') {
            return $redirectTarget.'?oauth=failed&message='.rawurlencode('Etat OAuth Open Platform invalide ou manquant.');
        }

        if ($code === null || trim($code) === '') {
            return $redirectTarget.'?oauth=failed&message='.rawurlencode('Code OAuth Open Platform manquant dans le callback.');
        }

        $accounts = $this->readJsonArray('alibaba-supplier-accounts.json');
        $accountId = trim((string) $decodedState['accountId']);
        $account = collect($accounts)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $accountId);
        if (! is_array($account)) {
            return $redirectTarget.'?oauth=failed&message='.rawurlencode('Compte fournisseur Open Platform introuvable au retour OAuth.');
        }

        try {
            $result = $this->openPlatform->exchangeOAuthCode($account, trim($code));
            $updatedAccount = $result['account'];
            $this->persistOAuthAccount($updatedAccount);

            return $redirectTarget.'?oauth=success&message='.rawurlencode('Compte fournisseur connecte avec succes.');
        } catch (Throwable $exception) {
            $this->markSupplierAccountOAuthError($accountId, $exception->getMessage());
            return $redirectTarget.'?oauth=failed&message='.rawurlencode($exception->getMessage());
        }
    }

    public function refreshSupplierAccount(string $accountId): array
    {
        $accounts = $this->readJsonArray('alibaba-supplier-accounts.json');
        $account = collect($accounts)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $accountId);
        if (! is_array($account)) {
            throw new RuntimeException('Compte fournisseur introuvable.');
        }

        $result = $this->openPlatform->refreshTokens($account);
        $updated = $result['account'];
        $this->persistOAuthAccount($updated);

        return [
            'account' => $this->sanitizeSupplierAccounts([$updated])[0],
            'refreshed' => true,
        ];
    }

    public function saveReceptionAddress(array $input): array
    {
        $addresses = $this->readJsonArray('alibaba-reception-addresses.json');
        $id = trim((string) ($input['id'] ?? '')) ?: (string) Str::uuid();
        $existing = collect($addresses)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $id);
        $now = $this->nowIso();
        $isDefault = ($input['isDefault'] ?? (is_array($existing) ? ($existing['isDefault'] ?? true) : true)) === true;

        $address = [
            'id' => $id,
            'label' => $this->stringOrFallback($input['label'] ?? null, is_array($existing) ? ($existing['label'] ?? 'Entrepot principal') : 'Entrepot principal'),
            'contactName' => $this->stringOrFallback($input['contactName'] ?? null, is_array($existing) ? ($existing['contactName'] ?? '') : ''),
            'phone' => $this->stringOrFallback($input['phone'] ?? null, is_array($existing) ? ($existing['phone'] ?? '') : ''),
            'email' => $this->stringOrFallback($input['email'] ?? null, is_array($existing) ? ($existing['email'] ?? '') : ''),
            'addressLine1' => $this->stringOrFallback($input['addressLine1'] ?? null, is_array($existing) ? ($existing['addressLine1'] ?? '') : ''),
            'addressLine2' => $this->stringOrNull($input['addressLine2'] ?? (is_array($existing) ? ($existing['addressLine2'] ?? null) : null)),
            'city' => $this->stringOrFallback($input['city'] ?? null, is_array($existing) ? ($existing['city'] ?? '') : ''),
            'state' => $this->stringOrFallback($input['state'] ?? null, is_array($existing) ? ($existing['state'] ?? '') : ''),
            'postalCode' => $this->stringOrNull($input['postalCode'] ?? (is_array($existing) ? ($existing['postalCode'] ?? null) : null)),
            'countryCode' => strtoupper($this->stringOrFallback($input['countryCode'] ?? null, is_array($existing) ? ($existing['countryCode'] ?? 'FR') : 'FR')),
            'port' => $this->stringOrNull($input['port'] ?? (is_array($existing) ? ($existing['port'] ?? null) : null)),
            'portCode' => $this->stringOrNull($input['portCode'] ?? (is_array($existing) ? ($existing['portCode'] ?? null) : null)),
            'isDefault' => $isDefault,
            'createdAt' => is_array($existing) ? ($existing['createdAt'] ?? $now) : $now,
            'updatedAt' => $now,
        ];

        $addresses = array_values(array_filter($addresses, fn ($item) => ! is_array($item) || (string) ($item['id'] ?? '') !== $id));
        if ($isDefault) {
            foreach ($addresses as &$entry) {
                if (is_array($entry)) {
                    $entry['isDefault'] = false;
                    $entry['updatedAt'] = $now;
                }
            }
            unset($entry);
        }

        $addresses[] = $address;
        $this->writeJsonArray('alibaba-reception-addresses.json', $addresses);

        return ['address' => $address];
    }

    public function saveCountryProfiles(array $profiles): array
    {
        $normalized = [];
        foreach ($profiles as $profile) {
            if (! is_array($profile)) {
                continue;
            }

            $normalized[] = [
                'countryCode' => strtoupper($this->stringOrFallback($profile['countryCode'] ?? null, 'FR')),
                'countryName' => $this->stringOrFallback($profile['countryName'] ?? null, 'Country'),
                'currencyCode' => strtoupper($this->stringOrFallback($profile['currencyCode'] ?? null, 'USD')),
                'defaultCarrierCode' => $this->stringOrFallback($profile['defaultCarrierCode'] ?? null, 'CAINIAO_STANDARD'),
                'importTaxRate' => $this->toFloat($profile['importTaxRate'] ?? 0),
                'customsMode' => $this->stringOrFallback($profile['customsMode'] ?? null, 'personal'),
                'clearanceCodeLabel' => $this->stringOrFallback($profile['clearanceCodeLabel'] ?? null, 'Code'),
                'enabled' => ($profile['enabled'] ?? false) === true,
            ];
        }

        $this->writeJsonArray('alibaba-country-profiles.json', $normalized);

        return ['profiles' => $normalized];
    }

    public function publishImportedProducts(array $productIds, ?array $loadedImportedProducts = null): array
    {
        $ids = array_values(array_filter(array_map(fn ($id) => trim((string) $id), $productIds)));
        if ($ids === []) {
            throw new RuntimeException('Aucun produit importe selectionne pour la publication.');
        }

        $importedProducts = $loadedImportedProducts ?? $this->readJsonArray('alibaba-imported-products.json');
        $byId = array_flip($ids);
        $publishedCount = 0;
        $now = $this->nowIso();

        foreach ($importedProducts as &$item) {
            if (! is_array($item) || ! isset($byId[(string) ($item['id'] ?? '')])) {
                continue;
            }

            $this->upsertCatalogProductFromImported($item);
            $item['publishedToSite'] = true;
            $item['publishedAt'] = $item['publishedAt'] ?? $now;
            $item['status'] = 'published';
            $item['updatedAt'] = $now;
            $publishedCount++;
        }
        unset($item);

        $this->writeJsonArray('alibaba-imported-products.json', $importedProducts);

        return ['publishedCount' => $publishedCount];
    }

    public function syncImportedProductBuyerItem(string $importedProductId): array
    {
        $products = $this->readJsonArray('alibaba-imported-products.json');
        $index = $this->findImportedProductIndex($products, $importedProductId);
        if ($index === null) {
            throw new RuntimeException('Article importe introuvable pour la synchronisation Buyer Item.');
        }

        $product = is_array($products[$index]) ? $products[$index] : null;
        if (! is_array($product)) {
            throw new RuntimeException('Article importe invalide pour la synchronisation Buyer Item.');
        }

        $account = $this->resolveLiveAccount(null, true);
        if ($account === null) {
            throw new RuntimeException('Aucun compte fournisseur connecte n\'est disponible pour synchroniser un Buyer Item.');
        }

        $rawPayload = is_array($product['rawPayload'] ?? null) ? $product['rawPayload'] : [];
        $buyerSharedItem = is_array($rawPayload['buyerSharedItem'] ?? null) ? $rawPayload['buyerSharedItem'] : [];
        $hasExistingItemId = trim((string) ($buyerSharedItem['itemId'] ?? '')) !== '';

        $result = $hasExistingItemId
            ? $this->openPlatform->updateAlibabaBuyerItem($account, $product)
            : $this->openPlatform->addAlibabaBuyerItem($account, $product);
        $this->persistResolvedLiveAccount($result['account']);

        $payload = is_array($result['payload'] ?? null) ? $result['payload'] : [];
        if (($payload['ok'] ?? false) !== true) {
            throw new RuntimeException((string) ($payload['resultMessage'] ?? 'Synchronisation Buyer Item impossible.'));
        }

        $query = $this->refreshBuyerSharedItemSnapshot($result['account'], $product, $buyerSharedItem);
        $products[$index] = $this->applyBuyerSharedItemSnapshot($product, [
            'itemId' => $query['itemId'] ?? ($buyerSharedItem['itemId'] ?? null),
            'isvItemId' => $query['isvItemId'] ?? ($product['sourceProductId'] ?? null),
            'title' => $query['title'] ?? ($product['title'] ?? null),
            'price' => $query['price'] ?? null,
            'originalPrice' => $query['originalPrice'] ?? null,
            'availableQuantity' => $query['availableQuantity'] ?? null,
            'currency' => $query['currency'] ?? null,
            'permalink' => $query['permalink'] ?? null,
            'state' => 'synced',
            'operation' => $hasExistingItemId ? 'update' : 'add',
            'lastResultCode' => $payload['resultCode'] ?? null,
            'lastResultMessage' => $payload['resultMessage'] ?? null,
            'requestId' => $payload['requestId'] ?? null,
            'syncedAt' => $this->nowIso(),
            'queryPagination' => $query['pagination'] ?? null,
        ]);

        $this->writeJsonArray('alibaba-imported-products.json', $products);

        return [
            'product' => $products[$index],
            'buyerItem' => is_array($products[$index]['rawPayload']['buyerSharedItem'] ?? null) ? $products[$index]['rawPayload']['buyerSharedItem'] : null,
        ];
    }

    public function refreshImportedProductBuyerItem(string $importedProductId): array
    {
        $products = $this->readJsonArray('alibaba-imported-products.json');
        $index = $this->findImportedProductIndex($products, $importedProductId);
        if ($index === null) {
            throw new RuntimeException('Article importe introuvable pour la verification Buyer Item.');
        }

        $product = is_array($products[$index]) ? $products[$index] : null;
        if (! is_array($product)) {
            throw new RuntimeException('Article importe invalide pour la verification Buyer Item.');
        }

        $account = $this->resolveLiveAccount(null, true);
        if ($account === null) {
            throw new RuntimeException('Aucun compte fournisseur connecte n\'est disponible pour verifier un Buyer Item.');
        }

        $rawPayload = is_array($product['rawPayload'] ?? null) ? $product['rawPayload'] : [];
        $buyerSharedItem = is_array($rawPayload['buyerSharedItem'] ?? null) ? $rawPayload['buyerSharedItem'] : [];
        $query = $this->refreshBuyerSharedItemSnapshot($account, $product, $buyerSharedItem);
        $products[$index] = $this->applyBuyerSharedItemSnapshot($product, [
            ...$query,
            'state' => ($query['itemId'] ?? null) !== null ? 'queried' : 'missing',
            'refreshedAt' => $this->nowIso(),
        ]);

        $this->writeJsonArray('alibaba-imported-products.json', $products);

        return [
            'product' => $products[$index],
            'buyerItem' => is_array($products[$index]['rawPayload']['buyerSharedItem'] ?? null) ? $products[$index]['rawPayload']['buyerSharedItem'] : null,
        ];
    }

    public function deleteImportedProductBuyerItem(string $importedProductId): array
    {
        $products = $this->readJsonArray('alibaba-imported-products.json');
        $index = $this->findImportedProductIndex($products, $importedProductId);
        if ($index === null) {
            throw new RuntimeException('Article importe introuvable pour le retrait Buyer Item.');
        }

        $product = is_array($products[$index]) ? $products[$index] : null;
        if (! is_array($product)) {
            throw new RuntimeException('Article importe invalide pour le retrait Buyer Item.');
        }

        $rawPayload = is_array($product['rawPayload'] ?? null) ? $product['rawPayload'] : [];
        $buyerSharedItem = is_array($rawPayload['buyerSharedItem'] ?? null) ? $rawPayload['buyerSharedItem'] : [];
        $itemId = trim((string) ($buyerSharedItem['itemId'] ?? ''));
        if ($itemId === '') {
            throw new RuntimeException('Aucun Buyer Item enregistre pour cet article importe.');
        }

        $account = $this->resolveLiveAccount(null, true);
        if ($account === null) {
            throw new RuntimeException('Aucun compte fournisseur connecte n\'est disponible pour retirer un Buyer Item.');
        }

        $result = $this->openPlatform->deleteAlibabaBuyerItem($account, [
            'item_id' => $itemId,
            'isv_item_id' => $this->stringOrNull($product['sourceProductId'] ?? null),
        ]);
        $this->persistResolvedLiveAccount($result['account']);

        $payload = is_array($result['payload'] ?? null) ? $result['payload'] : [];
        if (($payload['ok'] ?? false) !== true) {
            throw new RuntimeException((string) ($payload['resultMessage'] ?? 'Retrait Buyer Item impossible.'));
        }

        $products[$index] = $this->applyBuyerSharedItemSnapshot($product, [
            'itemId' => null,
            'state' => 'deleted',
            'operation' => 'delete',
            'lastResultCode' => $payload['resultCode'] ?? null,
            'lastResultMessage' => $payload['resultMessage'] ?? null,
            'requestId' => $payload['requestId'] ?? null,
            'deletedAt' => $this->nowIso(),
        ]);

        $this->writeJsonArray('alibaba-imported-products.json', $products);

        return [
            'product' => $products[$index],
            'deleted' => true,
        ];
    }

    private function findImportedProductIndex(array $products, string $importedProductId): ?int
    {
        foreach ($products as $index => $item) {
            if (is_array($item) && (string) ($item['id'] ?? '') === $importedProductId) {
                return $index;
            }
        }

        return null;
    }

    private function refreshBuyerSharedItemSnapshot(array $account, array $product, array $existingSnapshot = []): array
    {
        $queryReq = array_filter([
            'item_id' => $this->stringOrNull($existingSnapshot['itemId'] ?? null),
            'isv_item_id' => $this->stringOrNull($product['sourceProductId'] ?? null),
            'current' => '1',
            'page_size' => '20',
        ], fn ($value) => $value !== null && $value !== '');

        $query = $this->openPlatform->queryAlibabaBuyerItem($account, $queryReq);
        $this->persistResolvedLiveAccount($query['account']);

        $payload = is_array($query['payload'] ?? null) ? $query['payload'] : [];
        if (($payload['ok'] ?? false) !== true) {
            return [
                'state' => 'query_failed',
                'queryResultCode' => $payload['resultCode'] ?? null,
                'queryResultMessage' => $payload['resultMessage'] ?? null,
                'queryRequestId' => $payload['requestId'] ?? null,
            ];
        }

        $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
        $itemId = $this->stringOrNull($existingSnapshot['itemId'] ?? null);
        $sourceProductId = $this->stringOrNull($product['sourceProductId'] ?? null);

        $match = collect($items)->first(function ($item) use ($itemId, $sourceProductId) {
            if (! is_array($item)) {
                return false;
            }

            return ($itemId !== null && (string) ($item['itemId'] ?? '') === $itemId)
                || ($sourceProductId !== null && (string) ($item['isvItemId'] ?? '') === $sourceProductId);
        });

        return [
            ...(is_array($match) ? $match : []),
            'state' => is_array($match) ? 'queried' : 'missing',
            'queryResultCode' => $payload['resultCode'] ?? null,
            'queryResultMessage' => $payload['resultMessage'] ?? null,
            'queryRequestId' => $payload['requestId'] ?? null,
            'pagination' => is_array($payload['pagination'] ?? null) ? $payload['pagination'] : null,
        ];
    }

    private function applyBuyerSharedItemSnapshot(array $product, array $snapshot): array
    {
        $rawPayload = is_array($product['rawPayload'] ?? null) ? $product['rawPayload'] : [];
        $previous = is_array($rawPayload['buyerSharedItem'] ?? null) ? $rawPayload['buyerSharedItem'] : [];
        $merged = [
            ...$previous,
            ...$snapshot,
        ];

        if (($merged['itemId'] ?? null) === null || trim((string) ($merged['itemId'] ?? '')) === '') {
            unset($merged['itemId']);
        }

        $rawPayload['buyerSharedItem'] = $merged;
        $product['rawPayload'] = $rawPayload;
        $product['updatedAt'] = $this->nowIso();

        return $product;
    }

    public function createPurchaseOrder(array $input): array
    {
        $importedProductId = trim((string) ($input['importedProductId'] ?? ''));
        $shippingAddressId = trim((string) ($input['shippingAddressId'] ?? ''));
        $quantity = max(1, (int) ($input['quantity'] ?? 1));

        $importedProducts = $this->readJsonArray('alibaba-imported-products.json');
        $product = collect($importedProducts)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $importedProductId);
        if (! is_array($product)) {
            throw new RuntimeException("Produit importe introuvable pour le lot d'achat.");
        }

        $addresses = $this->readJsonArray('alibaba-reception-addresses.json');
        $address = collect($addresses)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $shippingAddressId);
        if (! is_array($address)) {
            throw new RuntimeException('Adresse de reception introuvable.');
        }

        $account = $this->resolveLiveAccount(null, true);
        if ($account === null) {
            throw new RuntimeException('Aucun compte Open Platform connecte n\'est disponible pour creer une commande dropshipping live.');
        }
        $provider = 'alibaba';

        $prepared = $this->openPlatform->prepareDraftOrder($account, $product, $address, $quantity);
        $this->persistResolvedLiveAccount($prepared['account']);
        $overseasAdmittance = $this->openPlatform->checkAlibabaOverseasAdmittance($prepared['account']);
        $this->persistResolvedLiveAccount($overseasAdmittance['account']);
        $overseasPayload = is_array($overseasAdmittance['payload'] ?? null) ? $overseasAdmittance['payload'] : [];

        $orders = $this->readJsonArray('alibaba-purchase-orders.json');
        $now = $this->nowIso();
        $order = [
            'id' => (string) Str::uuid(),
            'sourceImportedProductId' => $importedProductId,
            'sourceProductId' => (string) ($product['sourceProductId'] ?? $importedProductId),
            'productTitle' => (string) ($product['title'] ?? 'Produit fournisseur'),
            'supplierName' => (string) ($product['supplierName'] ?? 'Fournisseur partenaire'),
            'supplierCompanyId' => $this->stringOrNull($product['supplierCompanyId'] ?? null),
            'quantity' => $quantity,
            'shippingAddressId' => $shippingAddressId,
            'logisticsPayload' => [
                'address' => $address,
                'quantity' => $quantity,
                'carrierCode' => $prepared['carrierCode'],
                'skuId' => $prepared['skuId'],
                'skuAttr' => $prepared['skuAttr'],
            ],
            'buyNowPayload' => $prepared['buyNowPayload'],
            'freightStatus' => 'verified',
            'orderStatus' => 'draft',
            'paymentStatus' => 'not_started',
            'tradeId' => null,
            'payUrl' => null,
            'payFailureReason' => null,
            'amountUsd' => round($this->toFloat($product['minUsd'] ?? 0) * $quantity, 2),
            'freightSummary' => $this->openPlatform->extractAlibabaFreightSummary($prepared['freightResult']['responseBody'] ?? null),
            'overseasAdmittance' => [
                'response' => $overseasPayload['response'] ?? false,
                'errorCode' => $overseasPayload['errorCode'] ?? null,
                'errorMessage' => $overseasPayload['errorMessage'] ?? null,
                'checkedAt' => $now,
            ],
            'mergePay' => null,
            'fund' => null,
            'tracking' => null,
            'orderDetail' => null,
            'logisticsQuery' => null,
            'createdAt' => $now,
            'updatedAt' => $now,
            'rawFreightResponse' => $prepared['freightResult']['responseBody'] ?? null,
            'rawOrderResponse' => [
                'provider' => $provider,
                'status' => 'draft_verified',
                'supplierAccountId' => $prepared['account']['id'] ?? null,
            ],
            'rawPaymentResponse' => null,
        ];

        $orders[] = $order;
        $this->writeJsonArray('alibaba-purchase-orders.json', $orders);

        return ['order' => $order];
    }

    public function createLiveDropshippingOrdersForClientOrder(Order $order): array
    {
        $account = $this->resolveLiveAccount(null, true);
        if ($account === null) {
            throw new RuntimeException('Aucun compte fournisseur connecte n\'est disponible pour creer une commande fournisseur live.');
        }

        $address = $this->buildDropshippingAddressFromOrder($order);
        $entries = [];
        $tradeIds = [];
        $paidCount = 0;
        $pendingCount = 0;
        $failedCount = 0;

        foreach ($order->orderItems()->with('product')->get() as $orderItem) {
            $product = $orderItem->product;
            if (! $product instanceof Product || ! in_array((string) $product->source_provider, ['alibaba', 'aliexpress'], true) || ! $product->source_product_id) {
                $entries[] = [
                    'orderItemId' => (string) $orderItem->getKey(),
                    'productSlug' => $orderItem->slug_snapshot,
                    'productTitle' => $orderItem->title_snapshot,
                    'requestOk' => false,
                    'status' => 'skipped',
                    'message' => 'Article non relie a un produit source fournisseur cote catalogue.',
                ];
                $failedCount++;
                continue;
            }

            $previewProduct = $this->toPreviewProductFromCatalogProduct($product);
            $prepared = $this->openPlatform->prepareDraftOrder($account, $previewProduct, $address, max(1, (int) $orderItem->quantity));
            $this->persistResolvedLiveAccount($prepared['account']);

            $result = $this->openPlatform->createDsOrder($prepared['account'], is_array($prepared['buyNowPayload'] ?? null) ? $prepared['buyNowPayload'] : []);
            $this->persistResolvedLiveAccount($result['account']);
            $orderResult = $result['result'];
            $tradeId = $this->openPlatform->extractTradeIdFromResponse($orderResult['responseBody']);
            $errorCode = $this->openPlatform->extractOperationCodeFromResponse($orderResult['responseBody']);
            $errorMessage = $this->openPlatform->extractOperationMessageFromResponse($orderResult['responseBody']);
            $dsOrderCreated = $orderResult['ok'] && ($this->openPlatform->isOperationSuccessful($orderResult['responseBody']) || $tradeId !== null);
            $payUrl = null;
            $paymentStatus = 'failed';
            $paymentMessage = $dsOrderCreated ? null : $this->formatAliExpressDsOrderCreateFailure($errorCode, $errorMessage);
            $paymentResponseBody = null;

            if ($dsOrderCreated && $tradeId !== null) {
                $tradeIds[] = $tradeId;
                $payment = $this->openPlatform->queryPaymentResult($result['account'], $tradeId);
                $this->persistResolvedLiveAccount($payment['account']);
                $paymentResult = $payment['result'];
                $paymentResponseBody = $paymentResult['responseBody'];
                $remoteStatus = strtoupper(trim((string) ($this->openPlatform->extractTradeOrderStatus($paymentResponseBody) ?? '')));
                $payUrl = $this->openPlatform->extractTradePayUrl($paymentResponseBody);
                $isPaid = in_array($remoteStatus, ['FINISH', 'PAID'], true);
                $isFailed = str_contains($remoteStatus, 'CANCEL') || str_contains($remoteStatus, 'CLOSE') || str_contains($remoteStatus, 'FAIL');
                $paymentStatus = $isPaid ? 'paid' : ($isFailed ? 'failed' : ($payUrl ? 'pay_url_generated' : 'pending'));
                $paymentMessage = $isFailed
                    ? ($this->openPlatform->extractOperationMessageFromResponse($paymentResponseBody) ?? 'Paiement fournisseur non complete.')
                    : null;
            }

            if ($paymentStatus === 'paid') {
                $paidCount++;
            } elseif (in_array($paymentStatus, ['pending', 'pay_url_generated'], true)) {
                $pendingCount++;
            } else {
                $failedCount++;
            }

            $entries[] = [
                'orderItemId' => (string) $orderItem->getKey(),
                'productId' => (string) $product->getKey(),
                'productSlug' => $product->slug,
                'sourceProductId' => (string) $product->source_product_id,
                'productTitle' => $product->title,
                'quantity' => (int) $orderItem->quantity,
                'tradeId' => $tradeId,
                'payUrl' => $payUrl,
                'requestOk' => $dsOrderCreated,
                'paymentStatus' => $paymentStatus,
                'message' => $paymentMessage,
                'freightCarrierCode' => $prepared['carrierCode'] ?? null,
                'freightSkuId' => $prepared['skuId'] ?? null,
                'rawFreightResponse' => $prepared['freightResult']['responseBody'] ?? null,
                'rawOrderResponse' => $orderResult['responseBody'] ?? null,
                'rawPaymentResponse' => $paymentResponseBody,
            ];
        }

        $status = $pendingCount > 0
            ? 'supplier_payment_requested'
            : ($paidCount > 0 && $failedCount > 0
                ? 'supplier_paid_partial'
                : ($paidCount > 0 ? 'supplier_paid' : 'supplier_payment_failed'));

        return [
            'status' => $status,
            'freightStatus' => $entries === [] ? 'failed' : 'verified',
            'supplierOrderStatus' => $tradeIds !== [] ? 'created' : 'failed',
            'alibabaTradeIds' => array_values(array_unique($tradeIds)),
            'supplierOrderPayload' => [
                'provider' => 'alibaba',
                'createdAt' => $this->nowIso(),
                'orders' => $entries,
            ],
        ];
    }

    public function payPurchaseOrder(string $orderId, string $action): array
    {
        $orders = $this->readJsonArray('alibaba-purchase-orders.json');
        $updatedOrder = null;
        $now = $this->nowIso();
        $account = $this->resolveLiveAccount(null, true);
        if ($account === null) {
            throw new RuntimeException('Aucun compte fournisseur connecte n\'est disponible pour le paiement fournisseur live.');
        }
        $isAlibabaAccount = ($account['provider'] ?? null) === 'alibaba';

        foreach ($orders as &$order) {
            if (! is_array($order) || (string) ($order['id'] ?? '') !== $orderId) {
                continue;
            }

            if ($action === 'refresh') {
                $tradeId = trim((string) ($order['tradeId'] ?? ''));
                if ($tradeId === '') {
                    throw new RuntimeException('Aucune commande DS live n\'a encore ete creee pour ce lot.');
                }
                $payment = $this->openPlatform->queryPaymentResult($account, $tradeId);
                $this->persistResolvedLiveAccount($payment['account']);
                $paymentResult = $payment['result'];
                $tradeError = $this->openPlatform->extractTradeError($paymentResult['responseBody']);
                $remoteStatus = strtoupper(trim((string) ($this->openPlatform->extractTradeOrderStatus($paymentResult['responseBody']) ?? '')));
                $payUrl = $this->openPlatform->extractTradePayUrl($paymentResult['responseBody']) ?? ($order['payUrl'] ?? null);
                $payFailureReason = $tradeError['subMessage'] ?? $tradeError['message'] ?? $this->openPlatform->extractOperationMessageFromResponse($paymentResult['responseBody']);
                $isPaid = in_array($remoteStatus, ['FINISH', 'PAID'], true);
                $isFailed = str_contains($remoteStatus, 'CANCEL') || str_contains($remoteStatus, 'CLOSE') || str_contains($remoteStatus, 'FAIL');

                $order['payUrl'] = $payUrl;
                $order['paymentStatus'] = $isPaid ? 'paid' : ($isAlibabaAccount && $payUrl ? 'pay_url_generated' : ($isFailed ? 'failed' : ($payUrl ? 'pay_url_generated' : 'pending')));
                $order['orderStatus'] = $isPaid ? 'paid' : ($isFailed && ! ($isAlibabaAccount && $payUrl) ? 'failed' : 'payment_pending');
                $order['payFailureReason'] = $isFailed && ! ($isAlibabaAccount && $payUrl) ? ($payFailureReason ?? 'Paiement non complete') : null;
                $order['rawPaymentResponse'] = $paymentResult['responseBody'];
                $this->hydrateAlibabaPurchaseOrderDiagnostics($account, $order);
            } elseif ($action === 'cancel') {
                $tradeId = trim((string) ($order['tradeId'] ?? ''));
                if ($tradeId === '') {
                    throw new RuntimeException('Aucune commande Alibaba n\'est encore associee a ce lot.');
                }

                $cancel = $this->openPlatform->cancelAlibabaOrder($account, $tradeId);
                $this->persistResolvedLiveAccount($cancel['account']);
                $payload = is_array($cancel['payload'] ?? null) ? $cancel['payload'] : [];
                if (($payload['ok'] ?? false) !== true) {
                    throw new RuntimeException($this->openPlatform->extractOperationMessageFromResponse($payload['responseBody'] ?? null) ?? 'Annulation Alibaba impossible.');
                }

                $order['orderStatus'] = 'cancelled';
                $order['paymentStatus'] = in_array((string) ($order['paymentStatus'] ?? ''), ['paid'], true) ? 'paid' : 'skipped';
                $order['payFailureReason'] = null;
                $order['rawOrderResponse'] = $payload['responseBody'] ?? ($order['rawOrderResponse'] ?? null);
                $this->hydrateAlibabaPurchaseOrderDiagnostics($cancel['account'], $order);
            } else {
                $existingTradeId = trim((string) ($order['tradeId'] ?? ''));
                if ($isAlibabaAccount && $action === 'repay' && $existingTradeId !== '') {
                    $payment = $this->openPlatform->payDropshippingOrder($account, $existingTradeId);
                    $this->persistResolvedLiveAccount($payment['account']);
                    $paymentResult = $payment['result'];
                    $remoteStatus = strtoupper(trim((string) ($this->openPlatform->extractTradeOrderStatus($paymentResult['responseBody']) ?? '')));
                    $payUrl = $this->openPlatform->extractTradePayUrl($paymentResult['responseBody']) ?? ($order['payUrl'] ?? null);
                    $isPaid = in_array($remoteStatus, ['FINISH', 'PAID', 'PAY_SUCCESS', 'SUCCESS'], true);
                    $isFailed = str_contains($remoteStatus, 'CANCEL') || str_contains($remoteStatus, 'CLOSE') || str_contains($remoteStatus, 'FAIL');
                    $order['payUrl'] = $payUrl;
                    $order['paymentStatus'] = $isPaid ? 'paid' : ($payUrl ? 'pay_url_generated' : ($isFailed ? 'failed' : 'pending'));
                    $order['orderStatus'] = $isPaid ? 'paid' : ($isFailed && ! $payUrl ? 'failed' : 'payment_pending');
                    $order['payFailureReason'] = $isFailed
                        ? ($payUrl ? null : ($this->openPlatform->extractOperationMessageFromResponse($paymentResult['responseBody']) ?? 'Paiement dropshipping Alibaba non complete.'))
                        : null;
                    $order['rawPaymentResponse'] = $paymentResult['responseBody'];
                    $this->hydrateAlibabaPurchaseOrderDiagnostics($account, $order);
                    $order['updatedAt'] = $now;
                    $updatedOrder = $order;
                    break;
                }

                $result = $this->openPlatform->createDsOrder($account, is_array($order['buyNowPayload'] ?? null) ? $order['buyNowPayload'] : []);
                $this->persistResolvedLiveAccount($result['account']);
                $orderResult = $result['result'];
                $tradeId = $this->openPlatform->extractTradeIdFromResponse($orderResult['responseBody']);
                $errorCode = $this->openPlatform->extractOperationCodeFromResponse($orderResult['responseBody']);
                $errorMessage = $this->openPlatform->extractOperationMessageFromResponse($orderResult['responseBody']);
                $dsOrderCreated = $orderResult['ok'] && ($this->openPlatform->isOperationSuccessful($orderResult['responseBody']) || $tradeId !== null);
                $dsAutoPayFailed = $dsOrderCreated && $this->isAliExpressDsAutoPayFailure($errorMessage);

                $order['tradeId'] = $tradeId ?? ($order['tradeId'] ?? null);
                $order['orderStatus'] = $dsOrderCreated ? 'order_created' : 'failed';
                $order['paymentStatus'] = $dsOrderCreated ? ($dsAutoPayFailed ? 'failed' : 'pending') : 'failed';
                $order['payFailureReason'] = $dsOrderCreated
                    ? ($dsAutoPayFailed ? $this->formatAliExpressDsAutoPayFailure($errorMessage) : null)
                    : $this->formatAliExpressDsOrderCreateFailure($errorCode, $errorMessage);
                $order['rawOrderResponse'] = $orderResult['responseBody'];

                if ($dsOrderCreated && $tradeId !== null) {
                    $payment = $isAlibabaAccount
                        ? $this->openPlatform->payDropshippingOrder($result['account'], $tradeId)
                        : $this->openPlatform->queryPaymentResult($result['account'], $tradeId);
                    $this->persistResolvedLiveAccount($payment['account']);
                    $paymentResult = $payment['result'];
                    $remoteStatus = strtoupper(trim((string) ($this->openPlatform->extractTradeOrderStatus($paymentResult['responseBody']) ?? '')));
                    $payUrl = $this->openPlatform->extractTradePayUrl($paymentResult['responseBody']);
                    $isPaid = in_array($remoteStatus, ['FINISH', 'PAID', 'PAY_SUCCESS', 'SUCCESS'], true);
                    $isFailed = str_contains($remoteStatus, 'CANCEL') || str_contains($remoteStatus, 'CLOSE') || str_contains($remoteStatus, 'FAIL');
                    $order['payUrl'] = $payUrl;
                    $order['paymentStatus'] = $isPaid ? 'paid' : ($isAlibabaAccount && $payUrl ? 'pay_url_generated' : ($isFailed ? 'failed' : ($payUrl ? 'pay_url_generated' : 'pending')));
                    $order['orderStatus'] = $isPaid ? 'paid' : ($isFailed && ! ($isAlibabaAccount && $payUrl) ? 'failed' : 'payment_pending');
                    $order['rawPaymentResponse'] = $paymentResult['responseBody'];
                    if ($isFailed && ! ($isAlibabaAccount && $payUrl) && $order['payFailureReason'] === null) {
                        $order['payFailureReason'] = $this->openPlatform->extractOperationMessageFromResponse($paymentResult['responseBody']) ?? 'Paiement non complete';
                    }
                    $this->hydrateAlibabaPurchaseOrderDiagnostics($account, $order);
                }
            }

            $order['updatedAt'] = $now;
            $updatedOrder = $order;
            break;
        }
        unset($order);

        if (! is_array($updatedOrder)) {
            throw new RuntimeException("Lot d'achat introuvable.");
        }

        $this->writeJsonArray('alibaba-purchase-orders.json', $orders);

        return ['order' => $updatedOrder];
    }

    private function hydrateAlibabaPurchaseOrderDiagnostics(array $account, array &$order): void
    {
        $tradeId = trim((string) ($order['tradeId'] ?? ''));
        if ($tradeId === '') {
            return;
        }

        $mergePay = $this->openPlatform->queryAlibabaMergePay($account, [$tradeId]);
        $this->persistResolvedLiveAccount($mergePay['account']);
        $mergePayload = is_array($mergePay['payload'] ?? null) ? $mergePay['payload'] : [];
        $order['mergePay'] = [
            ...(is_array($mergePayload['mergePay'] ?? null) ? $mergePayload['mergePay'] : []),
            'checkedAt' => $this->nowIso(),
        ];

        $fund = $this->openPlatform->queryAlibabaOrderFund($mergePay['account'], $tradeId);
        $this->persistResolvedLiveAccount($fund['account']);
        $fundPayload = is_array($fund['payload'] ?? null) ? $fund['payload'] : [];
        $order['fund'] = [
            ...(is_array($fundPayload['fund'] ?? null) ? $fundPayload['fund'] : []),
            'checkedAt' => $this->nowIso(),
        ];

        $orderDetail = $this->openPlatform->queryAlibabaOrderDetail($fund['account'], $tradeId);
        $this->persistResolvedLiveAccount($orderDetail['account']);
        $orderDetailPayload = is_array($orderDetail['payload'] ?? null) ? $orderDetail['payload'] : [];
        $order['orderDetail'] = [
            ...(is_array($orderDetailPayload['order'] ?? null) ? $orderDetailPayload['order'] : []),
            'checkedAt' => $this->nowIso(),
        ];
        if (trim((string) ($order['payUrl'] ?? '')) === '' && trim((string) ($order['orderDetail']['payUrl'] ?? '')) !== '') {
            $order['payUrl'] = $order['orderDetail']['payUrl'];
        }

        $logistics = $this->openPlatform->queryAlibabaOrderLogistics($orderDetail['account'], $tradeId);
        $this->persistResolvedLiveAccount($logistics['account']);
        $logisticsPayload = is_array($logistics['payload'] ?? null) ? $logistics['payload'] : [];
        $order['logisticsQuery'] = [
            ...(is_array($logisticsPayload['logistics'] ?? null) ? $logisticsPayload['logistics'] : []),
            'checkedAt' => $this->nowIso(),
        ];

        $tracking = $this->openPlatform->queryAlibabaOrderTracking($logistics['account'], $tradeId);
        $this->persistResolvedLiveAccount($tracking['account']);
        $trackingPayload = is_array($tracking['payload'] ?? null) ? $tracking['payload'] : [];
        $order['tracking'] = [
            'trackingList' => is_array($trackingPayload['trackingList'] ?? null) ? $trackingPayload['trackingList'] : [],
            'checkedAt' => $this->nowIso(),
        ];
    }

    private function normalizePanel(?string $panel): string
    {
        $candidate = is_string($panel) ? trim($panel) : '';

        return in_array($candidate, self::PANEL_SLUGS, true) ? $candidate : 'dashboard';
    }

    private function buildDropshippingAddressFromOrder(Order $order): array
    {
        $meta = is_array($order->meta) ? $order->meta : [];
        $deliveryProfile = is_array($meta['deliveryProfile'] ?? null) ? $meta['deliveryProfile'] : [];
        $forwarder = is_array($deliveryProfile['forwarder'] ?? null) ? $deliveryProfile['forwarder'] : [];
        $hub = (string) ($forwarder['hub'] ?? '');
        $forwarderBlock = trim((string) ($forwarder['addressBlock'] ?? ''));

        if ($hub === 'china' && $forwarderBlock !== '') {
            $lines = array_values(array_filter(array_map('trim', preg_split('/\r?\n|,|;/', $forwarderBlock) ?: [])));
            preg_match('/\b(\d{6})\b/', $forwarderBlock, $postalMatch);

            return [
                'label' => 'Client Forwarder China',
                'contactName' => (string) $order->customer_name,
                'phone' => (string) ($order->customer_phone ?? ''),
                'email' => (string) $order->customer_email,
                'addressLine1' => $lines[0] ?? ((string) ($order->address_line1 ?? '')),
                'addressLine2' => count($lines) > 1 ? implode(', ', array_slice($lines, 1)) : (string) ($order->address_line2 ?? ''),
                'city' => (string) ($order->city ?: 'Shenzhen'),
                'state' => (string) ($order->state ?: 'Guangdong'),
                'postalCode' => $postalMatch[1] ?? ((string) ($order->postal_code ?? '518000')),
                'countryCode' => 'CN',
            ];
        }

        return [
            'label' => 'Customer Delivery Address',
            'contactName' => (string) $order->customer_name,
            'phone' => (string) ($order->customer_phone ?? ''),
            'email' => (string) $order->customer_email,
            'addressLine1' => (string) ($order->address_line1 ?? ''),
            'addressLine2' => (string) ($order->address_line2 ?? ''),
            'city' => (string) ($order->city ?? ''),
            'state' => (string) ($order->state ?? ''),
            'postalCode' => (string) ($order->postal_code ?? ''),
            'countryCode' => (string) ($order->country_code ?? 'FR'),
        ];
    }

    private function buildStorageState(): array
    {
        $defaultConnection = (string) config('database.default', '');
        $connection = config("database.connections.{$defaultConnection}", []);
        $host = is_array($connection) ? trim((string) ($connection['host'] ?? '')) : '';
        $database = is_array($connection) ? trim((string) ($connection['database'] ?? '')) : '';
        $persistentAvailable = $defaultConnection !== '' && ($host !== '' || ($defaultConnection === 'sqlite' && $database !== '' && $database !== ':memory:'));

        return [
            'persistentAvailable' => $persistentAvailable,
            'persistentRequired' => true,
            'issue' => $persistentAvailable
                ? null
                : "Le backend Laravel repond bien pour le flux fournisseur, mais aucune persistance base de donnees exploitable n'a ete detectee pour ce module. Verifie la configuration MySQL Hostinger cote backend.",
        ];
    }

    private function sanitizeSupplierAccounts(array $accounts): array
    {
        return array_values(array_map(function ($account) {
            if (! is_array($account)) {
                return $account;
            }

            $account['hasAppSecret'] = ! empty($account['appSecret']);
            $account['hasAccessToken'] = ! empty($account['accessToken']);
            $account['hasRefreshToken'] = ! empty($account['refreshToken']);
            unset($account['appSecret'], $account['accessToken'], $account['refreshToken']);

            return $account;
        }, $accounts));
    }

    private function resolveImportSources(array $input, array $existingImportedProducts): array
    {
        $prefetchedProduct = $input['prefetchedProduct'] ?? null;
        if (is_array($prefetchedProduct)) {
            return [$prefetchedProduct];
        }

        $query = trim((string) ($input['query'] ?? ''));
        $sourceProductId = $this->extractSourceProductId($query);
        $sources = [];

        if ($sourceProductId !== '') {
            foreach ($existingImportedProducts as $item) {
                if (is_array($item) && (string) ($item['sourceProductId'] ?? '') === $sourceProductId) {
                    $sources[] = $this->toPreviewProductFromImported($item);
                }
            }

            try {
                $dbProducts = Product::query()->where('source_product_id', $sourceProductId)->get();
                foreach ($dbProducts as $product) {
                    $sources[] = $this->toPreviewProductFromCatalogProduct($product);
                }
            } catch (Throwable) {
            }

            return $sources;
        }

        return array_map(fn ($item) => $item['product'], $this->search([
            'query' => $query,
            'pageSize' => (int) ($input['limit'] ?? 20),
            'pageIndex' => 1,
        ])['products'] ?? []);
    }

    private function buildImportedProductRecord(array $source, array $input, string $timestamp): array
    {
        $sourceProductId = $this->stringOrFallback($source['sourceProductId'] ?? $source['productId'] ?? null, (string) Str::uuid());
        $title = $this->stringOrFallback($source['title'] ?? $source['shortTitle'] ?? null, 'Produit fournisseur');
        $shortTitle = $this->stringOrFallback($source['shortTitle'] ?? null, $title);
        $rawPayload = is_array($source['rawPayload'] ?? null) ? $source['rawPayload'] : $source;
        $dispatchLocation = $this->resolveDispatchLocation($source, $rawPayload);
        $rawGallery = $this->extractRawMediaGallery($rawPayload);
        $gallery = $this->normalizeGallery([
            $source['gallery'] ?? null,
            $rawGallery,
        ], $source['image'] ?? $source['imageUrl'] ?? ($rawGallery[0] ?? null));
        $primaryImage = $this->normalizeMediaUrl($this->stringOrFallback($source['image'] ?? $source['imageUrl'] ?? ($gallery[0] ?? null), '/globe.svg'));
        $videoUrl = $this->normalizeMediaUrl($this->stringOrNull($source['videoUrl'] ?? null) ?? $this->extractRawVideoUrl($rawPayload));
        $videoPoster = $this->normalizeMediaUrl($this->stringOrNull($source['videoPoster'] ?? null) ?? $this->extractRawVideoPoster($rawPayload) ?? $primaryImage);
        $campaignMode = $this->stringOrNull($input['campaignMode'] ?? null);
        if ($campaignMode !== null) {
            $rawPayload['afripayCampaign'] = ['mode' => $campaignMode];
        }

        $resolvedCategory = $this->resolveCatalogCategoryData([
            'categorySlug' => $source['categorySlug'] ?? $source['categoryId'] ?? null,
            'categoryTitle' => $source['categoryTitle'] ?? null,
            'categoryPath' => $source['categoryPath'] ?? null,
            'title' => $title,
            'query' => $input['manualSeedQuery'] ?? $input['query'] ?? null,
        ]);

        return [
            'id' => (string) Str::uuid(),
            'sourceProductId' => $sourceProductId,
            'categorySlug' => $resolvedCategory['slug'],
            'categoryTitle' => $resolvedCategory['title'],
            'categoryPath' => $resolvedCategory['path'],
            'slug' => $this->slugify($this->stringOrFallback($source['slug'] ?? null, $shortTitle.'-'.$sourceProductId)),
            'title' => $title,
            'shortTitle' => $shortTitle,
            'description' => $this->stringOrFallback($source['description'] ?? null, $title),
            'query' => $this->stringOrFallback($input['manualSeedQuery'] ?? $input['query'] ?? null, $sourceProductId),
            'keywords' => $this->normalizeStringArray($source['keywords'] ?? null),
            'image' => $primaryImage,
            'gallery' => $gallery,
            'videoUrl' => $videoUrl,
            'videoPoster' => $videoPoster,
            'packaging' => $this->stringOrFallback($source['packaging'] ?? null, 'Carton'),
            'packageDimensionsCm' => is_array($source['packageDimensionsCm'] ?? null) ? $source['packageDimensionsCm'] : null,
            'itemWeightGrams' => $this->toInt($source['itemWeightGrams'] ?? 0),
            'lotCbm' => (string) ($source['lotCbm'] ?? '0'),
            'minUsd' => $this->toFloat($source['minUsd'] ?? $source['salePrice'] ?? $source['targetSalePrice'] ?? 0),
            'maxUsd' => $this->nullableFloat($source['maxUsd'] ?? $source['originalPrice'] ?? $source['targetOriginalPrice'] ?? null),
            'moq' => max(1, $this->toInt($source['moq'] ?? 1)),
            'moqVerified' => ($source['moqVerified'] ?? true) !== false,
            'unit' => $this->stringOrFallback($source['unit'] ?? null, 'piece'),
            'badge' => $this->stringOrNull($source['badge'] ?? null),
            'supplierName' => $this->stringOrFallback($source['supplierName'] ?? null, 'Fournisseur partenaire'),
            'supplierLocation' => $this->stringOrFallback($source['supplierLocation'] ?? null, 'China'),
            'supplierCompanyId' => $this->stringOrNull($source['supplierCompanyId'] ?? null),
            'responseTime' => $this->stringOrFallback($source['responseTime'] ?? null, '24h'),
            'yearsInBusiness' => $this->toInt($source['yearsInBusiness'] ?? 1),
            'transactionsLabel' => $this->stringOrFallback($source['transactionsLabel'] ?? null, 'Transactions verifiees'),
            'soldLabel' => $this->stringOrFallback($source['soldLabel'] ?? null, 'Best seller'),
            'customizationLabel' => $this->stringOrFallback($source['customizationLabel'] ?? null, 'Personnalisation disponible'),
            'shippingLabel' => $this->stringOrFallback($source['shippingLabel'] ?? null, 'Expedition internationale'),
            'dispatchLocation' => $dispatchLocation,
            'chinaLocalFreightFcfa' => $this->nullableInt($source['chinaLocalFreightFcfa'] ?? null),
            'chinaLocalFreightLabel' => $this->stringOrNull($source['chinaLocalFreightLabel'] ?? null),
            'overview' => $this->normalizeStringArray($source['overview'] ?? null),
            'variantGroups' => $this->normalizeVariantGroups($source['variantGroups'] ?? null),
            'variantPricing' => is_array($source['variantPricing'] ?? null) ? array_values($source['variantPricing']) : [],
            'variantSkus' => is_array($source['variantSkus'] ?? null) ? array_values($source['variantSkus']) : [],
            'tiers' => is_array($source['tiers'] ?? null) ? array_values($source['tiers']) : [],
            'specs' => is_array($source['specs'] ?? null) ? array_values($source['specs']) : [],
            'weightVerified' => ($source['weightVerified'] ?? true) !== false,
            'priceVerified' => ($source['priceVerified'] ?? true) !== false,
            'inventory' => max(0, $this->toInt($source['inventory'] ?? 100)),
            'status' => 'imported',
            'publishedToSite' => false,
            'createdAt' => $timestamp,
            'updatedAt' => $timestamp,
            'publishedAt' => null,
            'rawPayload' => $rawPayload,
        ];
    }

    private function upsertCatalogProductFromImported(array $item): void
    {
        $resolvedCategory = $this->resolveCatalogCategoryData($item);
        $rawPayload = is_array($item['rawPayload'] ?? null) ? $item['rawPayload'] : $item;
        $dispatchLocation = $this->resolveDispatchLocation($item, $rawPayload);
        $rawGallery = $this->extractRawMediaGallery($rawPayload);
        $gallery = $this->normalizeGallery([
            $item['gallery'] ?? null,
            $rawGallery,
        ], $item['image'] ?? ($rawGallery[0] ?? null));
        $image = $this->normalizeMediaUrl($this->stringOrFallback($item['image'] ?? ($gallery[0] ?? null), '/globe.svg'));
        $videoUrl = $this->normalizeMediaUrl($this->stringOrNull($item['videoUrl'] ?? null) ?? $this->extractRawVideoUrl($rawPayload));
        $videoPoster = $this->normalizeMediaUrl($this->stringOrNull($item['videoPoster'] ?? null) ?? $this->extractRawVideoPoster($rawPayload) ?? $image);
        $metadata = [
            'shortTitle' => $item['shortTitle'] ?? $item['title'],
            'videoUrl' => $videoUrl,
            'videoPoster' => $videoPoster,
            'maxUsd' => $item['maxUsd'] ?? null,
            'moqVerified' => $item['moqVerified'] ?? true,
            'weightVerified' => $item['weightVerified'] ?? (($item['itemWeightGrams'] ?? 0) > 0),
            'priceVerified' => $item['priceVerified'] ?? true,
            'packaging' => $item['packaging'] ?? 'Carton',
            'packageDimensionsCm' => is_array($item['packageDimensionsCm'] ?? null) ? $item['packageDimensionsCm'] : null,
            'itemWeightGrams' => $item['itemWeightGrams'] ?? 0,
            'lotCbm' => $item['lotCbm'] ?? '0',
            'responseTime' => $item['responseTime'] ?? '24h',
            'yearsInBusiness' => $item['yearsInBusiness'] ?? 1,
            'transactionsLabel' => $item['transactionsLabel'] ?? 'Transactions verifiees',
            'soldLabel' => $item['soldLabel'] ?? 'Best seller',
            'customizationLabel' => $item['customizationLabel'] ?? 'Personnalisation disponible',
            'shippingLabel' => $item['shippingLabel'] ?? 'Expedition internationale',
            'dispatchLocation' => $dispatchLocation,
            'chinaLocalFreightFcfa' => $item['chinaLocalFreightFcfa'] ?? null,
            'chinaLocalFreightLabel' => $item['chinaLocalFreightLabel'] ?? null,
            'overview' => $item['overview'] ?? [],
            'tiers' => $item['tiers'] ?? [],
            'variantGroups' => $item['variantGroups'] ?? [],
            'variantPricing' => $item['variantPricing'] ?? [],
            'variantSkus' => $item['variantSkus'] ?? [],
            'specs' => $item['specs'] ?? [],
            'keywords' => $item['keywords'] ?? [],
            'categoryTitle' => $resolvedCategory['title'],
            'categoryPath' => $resolvedCategory['path'],
            'supplierPriceFcfa' => isset($item['minUsd']) ? (int) round($this->toFloat($item['minUsd']) * 650) : 0,
        ];

        $product = Product::query()->firstOrNew([
            'source_provider' => 'alibaba',
            'source_product_id' => (string) ($item['sourceProductId'] ?? $item['id']),
        ]);

        $product->fill([
            'title' => (string) ($item['title'] ?? 'Produit fournisseur'),
            'slug' => (string) ($item['slug'] ?? $this->slugify((string) ($item['title'] ?? 'produit-fournisseur'))),
            'description' => (string) ($item['description'] ?? $item['title'] ?? ''),
            'price' => round($this->toFloat($item['minUsd'] ?? 0), 2),
            'category' => $resolvedCategory['slug'],
            'stock' => max(0, $this->toInt($item['inventory'] ?? 0)),
            'image' => $image,
            'gallery' => $gallery,
            'supplier_name' => (string) ($item['supplierName'] ?? 'Fournisseur partenaire'),
            'supplier_location' => (string) ($item['supplierLocation'] ?? 'China'),
            'moq' => max(1, $this->toInt($item['moq'] ?? 1)),
            'unit' => (string) ($item['unit'] ?? 'piece'),
            'badge' => $item['badge'] ?? null,
            'is_published' => true,
            'metadata' => $metadata,
        ]);
        $product->save();
    }

    private function buildSearchPool(): array
    {
        $items = [];

        foreach ($this->readJsonArray('alibaba-imported-products.json') as $product) {
            if (! is_array($product)) {
                continue;
            }

            $items[] = $this->toSearchPreviewItemFromImported($product);
        }

        try {
            foreach (Product::query()->whereIn('source_provider', ['alibaba', 'aliexpress'])->latest()->limit(200)->get() as $product) {
                $preview = $this->toPreviewProductFromCatalogProduct($product);
                $items[] = $this->toSearchPreviewItemFromPreview($preview, [
                    'importReason' => 'Produit deja publie dans le catalogue Laravel.',
                    'importSource' => 'catalog_product',
                ]);
            }
        } catch (Throwable) {
        }

        return $items;
    }

    private function toSearchPreviewItemFromImported(array $product): array
    {
        $preview = $this->toPreviewProductFromImported($product);

        return $this->toSearchPreviewItemFromPreview($preview, [
            'itemUrl' => is_array($product['rawPayload'] ?? null) ? ($product['rawPayload']['itemUrl'] ?? null) : null,
            'importReason' => 'Snapshot deja present dans le stockage backend Laravel.',
            'importSource' => 'stored_snapshot',
        ]);
    }

    private function toSearchPreviewItemFromPreview(array $preview, array $extra = []): array
    {
        $minUsd = $this->toFloat($preview['minUsd'] ?? 0);
        $maxUsd = $this->nullableFloat($preview['maxUsd'] ?? null);
        $salePrice = number_format($minUsd, 2, '.', '');
        $originalPrice = $maxUsd !== null ? number_format($maxUsd, 2, '.', '') : null;

        return [
            'productId' => (string) ($preview['sourceProductId'] ?? $preview['productId'] ?? ''),
            'title' => (string) ($preview['title'] ?? $preview['shortTitle'] ?? 'Produit fournisseur'),
            'itemUrl' => $extra['itemUrl'] ?? null,
            'imageUrl' => $preview['image'] ?? '/globe.svg',
            'videoUrl' => $preview['videoUrl'] ?? null,
            'salePrice' => $salePrice,
            'salePriceFormat' => '$'.$salePrice,
            'salePriceCurrency' => 'USD',
            'originalPrice' => $originalPrice,
            'originalPriceFormat' => $originalPrice !== null ? '$'.$originalPrice : null,
            'originalPriceCurrency' => $originalPrice !== null ? 'USD' : null,
            'targetSalePrice' => $salePrice,
            'targetOriginalPrice' => $originalPrice,
            'targetOriginalPriceCurrency' => 'USD',
            'discount' => $maxUsd !== null && $maxUsd > 0 && $maxUsd > $minUsd
                ? (string) max(0, (int) round((1 - ($minUsd / $maxUsd)) * 100)).'%'
                : null,
            'orders' => null,
            'score' => null,
            'evaluateRate' => null,
            'categoryId' => $preview['categorySlug'] ?? null,
            'importable' => true,
            'importSource' => $extra['importSource'] ?? 'detail',
            'importReason' => $extra['importReason'] ?? null,
            'product' => $preview,
        ];
    }

    private function toPreviewProductFromImported(array $product): array
    {
        $rawPayload = is_array($product['rawPayload'] ?? null) ? $product['rawPayload'] : $product;

        return [
            'sourceProductId' => (string) ($product['sourceProductId'] ?? $product['id'] ?? ''),
            'shortTitle' => (string) ($product['shortTitle'] ?? $product['title'] ?? 'Produit fournisseur'),
            'title' => (string) ($product['title'] ?? 'Produit fournisseur'),
            'image' => (string) ($product['image'] ?? (($product['gallery'][0] ?? null) ?: '/globe.svg')),
            'minUsd' => $this->toFloat($product['minUsd'] ?? 0),
            'maxUsd' => $this->nullableFloat($product['maxUsd'] ?? null),
            'supplierName' => (string) ($product['supplierName'] ?? 'Fournisseur partenaire'),
            'supplierLocation' => (string) ($product['supplierLocation'] ?? 'China'),
            'inventory' => max(0, $this->toInt($product['inventory'] ?? 0)),
            'moq' => max(1, $this->toInt($product['moq'] ?? 1)),
            'unit' => (string) ($product['unit'] ?? 'piece'),
            'variantGroups' => $this->normalizeVariantGroups($product['variantGroups'] ?? null),
            'videoUrl' => $product['videoUrl'] ?? null,
            'gallery' => is_array($product['gallery'] ?? null) ? array_values($product['gallery']) : [],
            'badge' => $product['badge'] ?? null,
            'keywords' => $this->normalizeStringArray($product['keywords'] ?? null),
            'categorySlug' => $product['categorySlug'] ?? null,
            'categoryTitle' => $product['categoryTitle'] ?? null,
            'categoryPath' => $this->normalizeStringArray($product['categoryPath'] ?? null),
            'description' => $product['description'] ?? null,
            'packaging' => $product['packaging'] ?? null,
            'itemWeightGrams' => $product['itemWeightGrams'] ?? null,
            'lotCbm' => $product['lotCbm'] ?? null,
            'responseTime' => $product['responseTime'] ?? null,
            'yearsInBusiness' => $product['yearsInBusiness'] ?? null,
            'transactionsLabel' => $product['transactionsLabel'] ?? null,
            'soldLabel' => $product['soldLabel'] ?? null,
            'customizationLabel' => $product['customizationLabel'] ?? null,
            'shippingLabel' => $product['shippingLabel'] ?? null,
            'dispatchLocation' => $this->resolveDispatchLocation($product, $rawPayload),
            'overview' => $product['overview'] ?? [],
            'variantPricing' => $product['variantPricing'] ?? [],
            'tiers' => $product['tiers'] ?? [],
            'specs' => $product['specs'] ?? [],
            'rawPayload' => $rawPayload,
        ];
    }

    private function toPreviewProductFromCatalogProduct(Product $product): array
    {
        $metadata = is_array($product->metadata) ? $product->metadata : [];
        $rawPayload = is_array($metadata['rawPayload'] ?? null) ? $metadata['rawPayload'] : $metadata;

        return [
            'sourceProductId' => (string) ($product->source_product_id ?: $product->slug),
            'shortTitle' => (string) ($metadata['shortTitle'] ?? $product->title),
            'title' => (string) $product->title,
            'image' => (string) ($product->image ?: (($product->gallery[0] ?? null) ?: '/globe.svg')),
            'minUsd' => (float) $product->price,
            'maxUsd' => isset($metadata['maxUsd']) ? $this->nullableFloat($metadata['maxUsd']) : null,
            'supplierName' => (string) ($product->supplier_name ?? 'Fournisseur partenaire'),
            'supplierLocation' => (string) ($product->supplier_location ?? 'China'),
            'inventory' => (int) $product->stock,
            'moq' => (int) ($product->moq ?? 1),
            'unit' => (string) ($product->unit ?? 'piece'),
            'variantGroups' => $this->normalizeVariantGroups($metadata['variantGroups'] ?? null),
            'videoUrl' => $metadata['videoUrl'] ?? null,
            'gallery' => is_array($product->gallery) ? array_values($product->gallery) : [],
            'badge' => $product->badge,
            'keywords' => $this->normalizeStringArray($metadata['keywords'] ?? null),
            'categorySlug' => $product->category,
            'categoryTitle' => $this->stringOrNull($metadata['categoryTitle'] ?? null),
            'categoryPath' => $this->normalizeStringArray($metadata['categoryPath'] ?? null),
            'description' => $product->description,
            'packaging' => $metadata['packaging'] ?? null,
            'itemWeightGrams' => $metadata['itemWeightGrams'] ?? null,
            'lotCbm' => $metadata['lotCbm'] ?? null,
            'responseTime' => $metadata['responseTime'] ?? null,
            'yearsInBusiness' => $metadata['yearsInBusiness'] ?? null,
            'transactionsLabel' => $metadata['transactionsLabel'] ?? null,
            'soldLabel' => $metadata['soldLabel'] ?? null,
            'customizationLabel' => $metadata['customizationLabel'] ?? null,
            'shippingLabel' => $metadata['shippingLabel'] ?? null,
            'dispatchLocation' => $this->resolveDispatchLocation($metadata, $rawPayload),
            'overview' => $metadata['overview'] ?? [],
            'variantPricing' => $metadata['variantPricing'] ?? [],
            'tiers' => $metadata['tiers'] ?? [],
            'specs' => $metadata['specs'] ?? [],
            'rawPayload' => $rawPayload,
        ];
    }

    private function resolveDispatchLocation(array $item, array $rawPayload = []): string
    {
        $candidates = [
            $item['dispatchLocation'] ?? null,
            $item['dispatch_location'] ?? null,
            $item['shipping_from'] ?? null,
            $rawPayload['shipping_from'] ?? null,
        ];

        $detail = is_array($rawPayload['detail'] ?? null) ? $rawPayload['detail'] : null;
        if (is_array($detail)) {
            $candidates[] = $detail['shipping_from'] ?? null;
            $candidates[] = $detail['dispatchLocation'] ?? null;
            $candidates[] = $detail['dispatch_location'] ?? null;
        }

        foreach ($candidates as $candidate) {
            $value = strtoupper(trim((string) $candidate));
            if ($value !== '' && preg_match('/^[A-Z]{2,3}$/', $value) === 1) {
                return $value;
            }
        }

        return 'CN';
    }

    private function extractSourceProductId(string $value): string
    {
        if ($value === '') {
            return '';
        }

        if (preg_match('/(?:^|\D)(\d{8,20})(?:\D|$)/', $value, $matches) === 1) {
            return $matches[1];
        }

        return '';
    }

    private function resolveCatalogCategoryData(array $source): array
    {
        $path = $this->normalizeStringArray($source['categoryPath'] ?? null);
        $title = $this->stringOrNull($source['categoryTitle'] ?? null);
        $slugCandidate = $this->stringOrNull($source['categorySlug'] ?? $source['categoryId'] ?? null);

        $leaf = null;
        for ($index = count($path) - 1; $index >= 0; $index--) {
            if ($this->isUsefulCatalogCategoryLabel($path[$index] ?? null)) {
                $leaf = trim((string) $path[$index]);
                break;
            }
        }

        if (! $this->isUsefulCatalogCategoryLabel($title)) {
            $title = $leaf;
        }

        if (! $this->isUsefulCatalogCategoryLabel($title)) {
            $title = $this->stringOrNull($source['query'] ?? null);
        }

        if (! $this->isUsefulCatalogCategoryLabel($title)) {
            $title = $this->stringOrNull($source['title'] ?? null);
        }

        if (! $this->isUsefulCatalogCategoryLabel($title) && $this->isUsefulCatalogCategorySlug($slugCandidate)) {
            $title = str_replace('-', ' ', trim((string) $slugCandidate));
        }

        if (! $this->isUsefulCatalogCategoryLabel($title)) {
            $title = 'Autres produits';
        }

        if ($path === []) {
            $path = [$title];
        }

        $slug = $this->isUsefulCatalogCategorySlug($slugCandidate)
            ? $this->slugify((string) $slugCandidate)
            : $this->slugify($title);

        return [
            'slug' => $slug !== '' ? $slug : 'autres-produits',
            'title' => $title,
            'path' => $path,
        ];
    }

    private function isUsefulCatalogCategoryLabel($value): bool
    {
        if (! is_string($value)) {
            return false;
        }

        $normalized = trim(preg_replace('/\s+/', ' ', str_replace(['>', '/', '|', '_'], ' ', $value)) ?? '');
        if ($normalized === '') {
            return false;
        }

        if (mb_strlen($normalized) < 2 || mb_strlen($normalized) > 80) {
            return false;
        }

        if (! preg_match('/[\p{L}]/u', $normalized)) {
            return false;
        }

        return ! preg_match('/^(catalogue importe|produit aliexpress|produit alibaba|aliexpress|alibaba|general|misc|other|others|undefined|null|n\/?a|na|unknown|sans nom|untitled)$/iu', $normalized);
    }

    private function isUsefulCatalogCategorySlug($value): bool
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

    private function normalizeGallery($gallery, $fallbackImage = null): array
    {
        $normalized = [];
        if (is_string($gallery)) {
            $trimmed = trim($gallery);
            if ($trimmed !== '') {
                $decoded = json_decode($trimmed, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $normalized = $this->normalizeGallery($decoded, $fallbackImage);
                } else {
                    $normalized = array_values(array_filter(array_map(
                        fn ($entry) => $this->normalizeMediaUrl(trim((string) $entry)),
                        preg_split('/[;,|]/', $trimmed) ?: []
                    )));
                }
            }
        } elseif (is_array($gallery)) {
            foreach ($gallery as $image) {
                if (is_array($image)) {
                    $normalized = array_merge($normalized, $this->normalizeGallery($image, null));
                    continue;
                }

                $value = trim((string) $image);
                if ($value !== '') {
                    $normalized[] = $this->normalizeMediaUrl($value);
                }
            }
        }

        $fallback = $this->normalizeMediaUrl(trim((string) $fallbackImage));
        if ($normalized === [] && $fallback !== '') {
            $normalized[] = $fallback;
        }

        if ($normalized === []) {
            $normalized[] = '/globe.svg';
        }

        return array_values(array_unique($normalized));
    }

    private function normalizeMediaUrl(?string $value): string
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return '';
        }

        if (str_starts_with($normalized, '//')) {
            $normalized = 'https:'.$normalized;
        }

        return preg_replace('/(\.(?:jpg|jpeg|png|webp))_\d+x\d+\1$/i', '$1', $normalized) ?? $normalized;
    }

    private function collectRawMediaUrls($value, int $depth = 0, string $keyHint = ''): array
    {
        if ($depth > 6 || $value === null) {
            return [];
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return [];
            }

            $looksLikeMedia = preg_match('/^(https?:)?\/\//i', $trimmed) === 1
                || str_starts_with($trimmed, '/');
            $looksLikeImage = preg_match('/\.(?:jpg|jpeg|png|webp)(?:[?_].*)?$/i', $trimmed) === 1;

            return ($looksLikeMedia && $looksLikeImage) ? [$this->normalizeMediaUrl($trimmed)] : [];
        }

        if (is_array($value)) {
            $urls = [];
            foreach ($value as $nestedKey => $nestedValue) {
                $nextKeyHint = trim($keyHint.' '.(is_string($nestedKey) ? $nestedKey : ''));
                if (is_string($nestedKey) && preg_match('/video|mp4|m3u8|webm/i', $nestedKey) === 1) {
                    continue;
                }

                if (is_string($nestedKey) && preg_match('/image|img|photo|picture|gallery|poster|main_image|multi_image|url/i', $nestedKey) !== 1 && $depth >= 2) {
                    continue;
                }

                $urls = array_merge($urls, $this->collectRawMediaUrls($nestedValue, $depth + 1, $nextKeyHint));
            }

            return $urls;
        }

        return [];
    }

    private function extractRawMediaGallery($rawPayload): array
    {
        return array_values(array_unique(array_filter($this->collectRawMediaUrls($rawPayload))));
    }

    private function extractRawVideoUrl($value, int $depth = 0): ?string
    {
        if ($depth > 6 || $value === null) {
            return null;
        }

        if (is_string($value)) {
            $normalized = $this->normalizeMediaUrl($value);
            return preg_match('/\.(?:mp4|m3u8|webm)(?:\?|$)/i', $normalized) === 1 ? $normalized : null;
        }

        if (! is_array($value)) {
            return null;
        }

        foreach ($value as $key => $nestedValue) {
            if (is_string($key) && preg_match('/video|mp4|m3u8|webm/i', $key) === 1) {
                $candidate = $this->extractRawVideoUrl($nestedValue, $depth + 1);
                if ($candidate !== null) {
                    return $candidate;
                }
            }
        }

        foreach ($value as $nestedValue) {
            $candidate = $this->extractRawVideoUrl($nestedValue, $depth + 1);
            if ($candidate !== null) {
                return $candidate;
            }
        }

        return null;
    }

    private function extractRawVideoPoster($value, int $depth = 0): ?string
    {
        if ($depth > 6 || ! is_array($value)) {
            return null;
        }

        foreach ($value as $key => $nestedValue) {
            if (is_string($key) && preg_match('/poster|cover|thumbnail|thumb/i', $key) === 1) {
                $gallery = $this->extractRawMediaGallery($nestedValue);
                if ($gallery !== []) {
                    return $gallery[0];
                }
            }
        }

        foreach ($value as $nestedValue) {
            $candidate = $this->extractRawVideoPoster($nestedValue, $depth + 1);
            if ($candidate !== null) {
                return $candidate;
            }
        }

        return null;
    }

    private function normalizeVariantGroups($value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $groups = [];
        foreach ($value as $group) {
            if (! is_array($group)) {
                continue;
            }

            $label = trim((string) ($group['label'] ?? ''));
            $values = $this->normalizeStringArray($group['values'] ?? null);
            if ($label === '' || $values === []) {
                continue;
            }

            $groups[] = [
                'label' => $label,
                'values' => $values,
            ];
        }

        return $groups;
    }

    private function normalizeStringArray($value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $items = [];
        foreach ($value as $entry) {
            $normalized = trim((string) $entry);
            if ($normalized !== '') {
                $items[] = $normalized;
            }
        }

        return array_values($items);
    }

    private function stringOrFallback($value, string $fallback): string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : $fallback;
    }

    private function stringOrNull($value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    private function toFloat($value): float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        $normalized = preg_replace('/[^0-9.\-]/', '', (string) $value);

        return is_numeric($normalized) ? (float) $normalized : 0.0;
    }

    private function nullableFloat($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $this->toFloat($value);
    }

    private function toInt($value): int
    {
        if (is_numeric($value)) {
            return (int) round((float) $value);
        }

        $normalized = preg_replace('/[^0-9\-]/', '', (string) $value);

        return is_numeric($normalized) ? (int) $normalized : 0;
    }

    private function nullableInt($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $this->toInt($value);
    }

    private function slugify(string $value): string
    {
        $slug = Str::slug($value);

        return $slug !== '' ? $slug : 'alibaba-'.Str::lower(Str::random(8));
    }

    private function nowIso(): string
    {
        return now()->toIso8601String();
    }

    private function buildPayUrl(string $orderId, string $action): string
    {
        $base = rtrim((string) config('app.url', 'https://api.afripay.space'), '/');

        return $base.'/admin/alibaba-sourcing/lots?orderId='.rawurlencode($orderId).'&action='.rawurlencode($action);
    }

    private function resolveLiveAccount(?string $accountId = null, bool $allowEnvironmentFallback = true): ?array
    {
        $accounts = $this->readJsonArray('alibaba-supplier-accounts.json');
        $selected = null;

        if ($accountId !== null && $accountId !== '') {
            $selected = collect($accounts)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $accountId);
        }

        if (! is_array($selected)) {
            $selected = collect($accounts)->first(fn ($item) => is_array($item)
                && ($item['isActive'] ?? false) === true
                && (string) ($item['status'] ?? '') !== 'disabled'
                && trim((string) ($item['appKey'] ?? '')) !== ''
                && trim((string) ($item['appSecret'] ?? '')) !== '')
                ?: collect($accounts)->first(fn ($item) => is_array($item)
                    && (string) ($item['status'] ?? '') === 'connected'
                    && trim((string) ($item['appKey'] ?? '')) !== ''
                    && trim((string) ($item['appSecret'] ?? '')) !== '');
        }

        if (is_array($selected)) {
            return $selected;
        }

        return $allowEnvironmentFallback ? $this->openPlatform->makeEnvironmentAccount() : null;
    }

    private function persistResolvedLiveAccount(array $account): void
    {
        if ((string) ($account['id'] ?? '') === 'env-aliexpress') {
            return;
        }

        $this->persistOAuthAccount($account);
    }

    private function persistOAuthAccount(array $account): void
    {
        $accounts = $this->readJsonArray('alibaba-supplier-accounts.json');
        $id = (string) ($account['id'] ?? '');
        if ($id === '') {
            return;
        }

        $next = [];
        $now = $this->nowIso();
        foreach ($accounts as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            if ((string) ($entry['id'] ?? '') === $id) {
                $next[] = [
                    ...$entry,
                    ...$account,
                    'updatedAt' => $account['updatedAt'] ?? $now,
                ];
                continue;
            }

            if (($account['isActive'] ?? false) === true && ($entry['isActive'] ?? false) === true) {
                $entry['isActive'] = false;
                $entry['updatedAt'] = $now;
            }

            $next[] = $entry;
        }

        if (! collect($next)->contains(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $id)) {
            $next[] = $account;
        }

        $this->writeJsonArray('alibaba-supplier-accounts.json', $next);
    }

    private function markSupplierAccountOAuthError(string $accountId, string $message): void
    {
        $accounts = $this->readJsonArray('alibaba-supplier-accounts.json');
        $next = array_map(function ($entry) use ($accountId, $message) {
            if (! is_array($entry) || (string) ($entry['id'] ?? '') !== $accountId) {
                return $entry;
            }

            $entry['status'] = 'needs_auth';
            $entry['lastError'] = $message;
            $entry['updatedAt'] = $this->nowIso();
            return $entry;
        }, $accounts);

        $this->writeJsonArray('alibaba-supplier-accounts.json', $next);
    }

    private function isAliExpressDsAutoPayFailure(?string $errorMessage): bool
    {
        $normalized = strtolower(trim((string) $errorMessage));
        return str_contains($normalized, 'autopay fail')
            || str_contains($normalized, 'api pay fail')
            || str_contains($normalized, 'apipayfail')
            || str_contains($normalized, 'ordercreated, autopay fail');
    }

    private function formatAliExpressDsAutoPayFailure(?string $errorMessage): string
    {
        $details = trim((string) $errorMessage);
        $guidance = 'Commande fournisseur creee, mais le paiement automatique a echoue. Verifie la whitelist auto-pay, le compte acheteur fournisseur et le moyen de paiement lie au buyer account.';
        return $details !== '' ? $guidance.' Detail: '.$details : $guidance;
    }

    private function formatAliExpressDsOrderCreateFailure(?string $errorCode, ?string $errorMessage): string
    {
        $code = trim((string) $errorCode);
        $message = trim((string) $errorMessage);
        $normalizedMessage = strtolower($message);

        if ($code === 'ITEM_ID_NOT_FOUND') {
            return "L'article fournisseur n'existe plus ou l'identifiant produit est invalide.";
        }

        if ($code === 'Item is not allowed to this country') {
            return "Ce produit fournisseur n'est pas autorise a la vente pour le pays de destination choisi.";
        }

        if ($code === 'SKU_NOT_EXIST') {
            return "Le SKU fournisseur de ce produit n'existe plus ou n'a pas ete transmis. Reimporte l'article pour resynchroniser ses variantes avant de relancer le lot fournisseur.";
        }

        if ($code === 'B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL') {
            if (str_contains($normalizedMessage, 'city')) {
                return 'Adresse fournisseur invalide: la ville est obligatoire ou non reconnue.';
            }

            if (str_contains($normalizedMessage, 'state') || str_contains($normalizedMessage, 'province') || str_contains($normalizedMessage, 'county')) {
                return 'Adresse fournisseur invalide: l\'etat ou la province est obligatoire.';
            }

            if (str_contains($normalizedMessage, 'phone') || str_contains($normalizedMessage, 'country code')) {
                return 'Adresse fournisseur invalide: verifie le numero de telephone et l\'indicatif pays.';
            }

            if (str_contains($normalizedMessage, '2 and 32') || str_contains($normalizedMessage, '2 to 32') || str_contains($normalizedMessage, '2-32')) {
                return 'Adresse fournisseur invalide: le nom du contact doit contenir entre 2 et 32 caracteres.';
            }

            return $message !== '' ? 'Adresse fournisseur invalide: '.$message : 'Adresse fournisseur invalide. Verifie les champs ville, province, telephone et contact.';
        }

        if ($code === 'DELIVERY_METHOD_NOT_EXIST') {
            return 'Aucune methode de livraison fournisseur valide n\'est disponible pour cette adresse.';
        }

        if ($code === 'PRICE_PAY_CURRENCY_ERROR') {
            return 'La devise de paiement fournisseur ne correspond pas a la devise du produit.';
        }

        if ($code === 'INVENTORY_HOLD_ERROR') {
            return 'Le fournisseur a refuse la commande: stock insuffisant ou erreur de reservation d\'inventaire.';
        }

        if ($code === 'REPEATED_ORDER_ERROR') {
            return 'Le fournisseur signale une commande dupliquee pour ce lot.';
        }

        if ($code === 'USER_ACCOUNT_DISABLED') {
            return 'Le compte fournisseur utilise pour le paiement fournisseur est desactive.';
        }

        if ($code === 'BLACKLIST_BUYER_IN_LIST') {
            return 'Le compte acheteur fournisseur est temporairement bloque pour cette commande.';
        }

        return implode(' - ', array_filter([$code, $message])) ?: 'Lancement DS impossible';
    }

    private function appendLog(string $action, string $endpoint, string $status, array $requestBody, array $responseBody): void
    {
        $logs = $this->readJsonArray('alibaba-logs.json');
        $logs[] = [
            'id' => (string) Str::uuid(),
            'createdAt' => $this->nowIso(),
            'action' => $action,
            'endpoint' => $endpoint,
            'status' => $status,
            'requestBody' => $requestBody,
            'responseBody' => $responseBody,
        ];

        $this->writeJsonArray('alibaba-logs.json', $logs);
    }

    private function readJsonArray(string $fileName): array
    {
        $path = $this->resolveStoragePath($fileName);
        if (! File::exists($path)) {
            return [];
        }

        $decoded = json_decode((string) File::get($path), true);

        if (! is_array($decoded)) {
            return [];
        }

        if ($this->isAssocArray($decoded)) {
            foreach (['items', 'data', 'records', 'rows'] as $nestedCollectionKey) {
                if (isset($decoded[$nestedCollectionKey]) && is_array($decoded[$nestedCollectionKey])) {
                    return array_values($decoded[$nestedCollectionKey]);
                }
            }
        }

        $items = is_array($decoded) ? array_values($decoded) : [];

        if ($fileName === 'alibaba-imported-products.json') {
            $normalizedItems = [];
            $changed = false;

            foreach ($items as $item) {
                if (! is_array($item)) {
                    continue;
                }

                $normalized = $this->normalizeImportedProductMetrics($item);
                if ($normalized !== $item) {
                    $changed = true;
                }

                $normalizedItems[] = $normalized;
            }

            if ($changed) {
                $this->writeJsonArray($fileName, $normalizedItems);
            }

            return $normalizedItems;
        }

        return $items;
    }

    private function normalizeRecordList(array $items): array
    {
        return array_values(array_filter($items, static fn ($item) => is_array($item)));
    }

    private function writeJsonArray(string $fileName, array $payload): void
    {
        $path = $this->resolveStoragePath($fileName);
        $directory = dirname($path);
        if (! File::isDirectory($directory)) {
            File::makeDirectory($directory, 0755, true);
        }

        File::put($path, json_encode(array_values($payload), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
    }

    private function resolveStoragePath(string $fileName): string
    {
        $preferred = base_path("data/sourcing/{$fileName}");
        $fallback = dirname(base_path())."/data/sourcing/{$fileName}";

        if (File::exists($preferred) || ! File::exists($fallback)) {
            return $preferred;
        }

        return $fallback;
    }

    private function isAssocArray(array $value): bool
    {
        if ($value === []) {
            return false;
        }

        return array_keys($value) !== range(0, count($value) - 1);
    }

    private function normalizeImportedProductMetrics(array $item): array
    {
        $rawPayload = is_array($item['rawPayload'] ?? null) ? $item['rawPayload'] : null;
        if ($rawPayload === null) {
            return $item;
        }

        $packageDimensions = is_array($item['packageDimensionsCm'] ?? null)
            ? $item['packageDimensionsCm']
            : null;

        if (! $this->hasValidPackageDimensions($packageDimensions)) {
            $packageDimensions = $this->extractPackageDimensionsCm($rawPayload) ?? $this->parsePackagingDimensions($this->stringOrNull($item['packaging'] ?? null));
        }

        $weightGrams = $this->toInt($item['itemWeightGrams'] ?? 0);
        if ($weightGrams <= 0) {
            $weightGrams = $this->extractWeightGrams($rawPayload) ?? 0;
        }

        $lotCbm = trim((string) ($item['lotCbm'] ?? ''));
        if ($lotCbm === '' || $this->toFloat($lotCbm) <= 0) {
            $lotCbm = $this->formatLotCbm($packageDimensions);
        }

        $item['packageDimensionsCm'] = $this->hasValidPackageDimensions($packageDimensions) ? $packageDimensions : null;
        $item['itemWeightGrams'] = $weightGrams;
        $item['lotCbm'] = $lotCbm !== '' ? $lotCbm : '0.0000';
        $item['weightVerified'] = (($item['weightVerified'] ?? false) === true) || $weightGrams > 0;

        return $item;
    }

    private function hasValidPackageDimensions($packageDimensions): bool
    {
        return is_array($packageDimensions)
            && $this->toFloat($packageDimensions['lengthCm'] ?? 0) > 0
            && $this->toFloat($packageDimensions['widthCm'] ?? 0) > 0
            && $this->toFloat($packageDimensions['heightCm'] ?? 0) > 0;
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
            $candidate = $this->parsePackagingDimensions($this->stringOrNull($value[$dimensionKey] ?? null));
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

    private function formatLotCbm($packageDimensions): string
    {
        if (! is_array($packageDimensions)) {
            return '0.0000';
        }

        $length = $this->toFloat($packageDimensions['lengthCm'] ?? 0);
        $width = $this->toFloat($packageDimensions['widthCm'] ?? 0);
        $height = $this->toFloat($packageDimensions['heightCm'] ?? 0);

        if ($length <= 0 || $width <= 0 || $height <= 0) {
            return '0.0000';
        }

        return number_format(($length * $width * $height) / 1000000, 4, '.', '');
    }
}
