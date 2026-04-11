<?php

namespace App\Services;

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
        protected AliExpressOpenPlatformService $openPlatform,
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

            $this->appendLog('catalog-search', 'aliexpress.ds.text.search', 'success', $input, [
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

        $this->appendLog('catalog-search', 'internal/aliexpress/search', 'success', $input, [
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
            $this->appendLog('catalog-fetch-remote', 'aliexpress.ds.product.get', 'success', $input, [
                'sourceProductId' => $payload['sourceProductId'] ?? null,
                'live' => true,
            ]);
            return $payload;
        }

        $query = trim((string) ($input['query'] ?? ''));
        if ($query === '') {
            throw new RuntimeException("Import manuel impossible: saisis un External product ID AliExpress ou un lien produit AliExpress.");
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

            $this->appendLog('catalog-fetch-remote', 'internal/aliexpress/fetch-remote', 'success', $input, [
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

        $this->appendLog('catalog-fetch-remote', 'internal/aliexpress/fetch-remote', 'failed', $input, $debug);

        throw new RuntimeException("Produit AliExpress introuvable dans le stockage backend actuel. L'import exact live n'est pas encore porte en PHP; ajoute d'abord un snapshot via l'ancien flux ou importe depuis une source deja connue.");
    }

    public function import(array $input): array
    {
        $query = trim((string) ($input['query'] ?? ''));
        if ($query === '') {
            throw new RuntimeException("Requete d'import AliExpress manquante.");
        }

        $existing = $this->readJsonArray('alibaba-imported-products.json');
        $purgedCount = 0;
        if (($input['resetImportedProducts'] ?? false) === true) {
            $purgedCount = count($existing);
            $existing = [];
        }

        $sources = $this->resolveImportSources($input, $existing);
        if ($sources === []) {
            throw new RuntimeException("Aucun produit exploitable n'a ete trouve pour cet import Laravel. Le flux live AliExpress n'est pas encore porte en PHP; fournis un prefetchedProduct ou pars d'un snapshot deja stocke.");
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

        $this->appendLog('catalog-import', 'internal/aliexpress/import', 'success', $input, [
            'createdCount' => count($created),
            'purgedCount' => $purgedCount,
            'skippedExistingCount' => $skippedExistingCount,
        ]);

        return $response;
    }

    public function deleteImportedProducts(?string $importedProductId = null, ?string $sourceProductId = null): array
    {
        $products = $this->readJsonArray('alibaba-imported-products.json');

        if ($importedProductId === null) {
            $deletedCount = count($products);
            $this->writeJsonArray('alibaba-imported-products.json', []);

            return ['deletedCount' => $deletedCount];
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

        return ['deleted' => true, 'deletedCount' => $deletedCount];
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

        $account = [
            'id' => $id,
            'name' => $this->stringOrFallback($input['name'] ?? null, is_array($existing) ? ($existing['name'] ?? '') : ''),
            'email' => $this->stringOrFallback($input['email'] ?? null, is_array($existing) ? ($existing['email'] ?? '') : ''),
            'memberId' => $this->stringOrNull($input['memberId'] ?? (is_array($existing) ? ($existing['memberId'] ?? null) : null)),
            'resourceOwner' => $this->stringOrNull($input['resourceOwner'] ?? (is_array($existing) ? ($existing['resourceOwner'] ?? null) : null)),
            'appKey' => $this->stringOrNull($input['appKey'] ?? (is_array($existing) ? ($existing['appKey'] ?? null) : null)),
            'appSecret' => $this->stringOrFallback($input['appSecret'] ?? null, is_array($existing) ? ($existing['appSecret'] ?? '') : ''),
            'authorizeUrl' => $this->stringOrFallback($input['authorizeUrl'] ?? null, is_array($existing) ? ($existing['authorizeUrl'] ?? 'https://api-sg.aliexpress.com/oauth/authorize') : 'https://api-sg.aliexpress.com/oauth/authorize'),
            'tokenUrl' => $this->stringOrFallback($input['tokenUrl'] ?? null, is_array($existing) ? ($existing['tokenUrl'] ?? 'https://api-sg.aliexpress.com/rest/auth/token/security/create') : 'https://api-sg.aliexpress.com/rest/auth/token/security/create'),
            'refreshUrl' => $this->stringOrFallback($input['refreshUrl'] ?? null, is_array($existing) ? ($existing['refreshUrl'] ?? 'https://api-sg.aliexpress.com/rest/auth/token/security/refresh') : 'https://api-sg.aliexpress.com/rest/auth/token/security/refresh'),
            'apiBaseUrl' => $this->stringOrFallback($input['apiBaseUrl'] ?? null, is_array($existing) ? ($existing['apiBaseUrl'] ?? 'https://api-sg.aliexpress.com') : 'https://api-sg.aliexpress.com'),
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
        $target = $origin !== '' ? $origin.'/admin/aliexpress-sourcing/accounts' : '/admin/aliexpress-sourcing/accounts';
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

        $callbackUrl = rtrim((string) config('app.url', 'https://api.afripay.space'), '/').'/api/admin/aliexpress/supplier-accounts/oauth/callback';

        return $this->openPlatform->buildAuthorizationUrl($account, $callbackUrl, $target);
    }

    public function handleOAuthCallback(?string $code, ?string $state): string
    {
        $decodedState = $this->openPlatform->decodeOAuthState($state);
        $redirectTarget = is_array($decodedState) && is_string($decodedState['redirectUri'] ?? null) && trim((string) $decodedState['redirectUri']) !== ''
            ? trim((string) $decodedState['redirectUri'])
            : rtrim((string) config('app.frontend_url', config('app.url', 'https://afripay.space')), '/').'/admin/aliexpress-sourcing/accounts';

        if (! is_array($decodedState) || trim((string) ($decodedState['accountId'] ?? '')) === '') {
            return $redirectTarget.'?oauth=failed&message='.rawurlencode('Etat OAuth AliExpress invalide ou manquant.');
        }

        if ($code === null || trim($code) === '') {
            return $redirectTarget.'?oauth=failed&message='.rawurlencode('Code OAuth AliExpress manquant dans le callback.');
        }

        $accounts = $this->readJsonArray('alibaba-supplier-accounts.json');
        $accountId = trim((string) $decodedState['accountId']);
        $account = collect($accounts)->first(fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === $accountId);
        if (! is_array($account)) {
            return $redirectTarget.'?oauth=failed&message='.rawurlencode('Compte fournisseur AliExpress introuvable au retour OAuth.');
        }

        try {
            $result = $this->openPlatform->exchangeOAuthCode($account, trim($code));
            $updatedAccount = $result['account'];
            $this->persistOAuthAccount($updatedAccount);

            return $redirectTarget.'?oauth=success&message='.rawurlencode('Compte AliExpress connecte avec succes.');
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
            throw new RuntimeException('Aucun compte AliExpress connecte n\'est disponible pour creer une commande DS live.');
        }

        $prepared = $this->openPlatform->prepareDraftOrder($account, $product, $address, $quantity);
        $this->persistResolvedLiveAccount($prepared['account']);

        $orders = $this->readJsonArray('alibaba-purchase-orders.json');
        $now = $this->nowIso();
        $order = [
            'id' => (string) Str::uuid(),
            'sourceImportedProductId' => $importedProductId,
            'sourceProductId' => (string) ($product['sourceProductId'] ?? $importedProductId),
            'productTitle' => (string) ($product['title'] ?? 'Produit AliExpress'),
            'supplierName' => (string) ($product['supplierName'] ?? 'AliExpress Supplier'),
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
            'createdAt' => $now,
            'updatedAt' => $now,
            'rawFreightResponse' => $prepared['freightResult']['responseBody'] ?? null,
            'rawOrderResponse' => [
                'provider' => 'aliexpress-ds',
                'status' => 'draft_verified',
                'supplierAccountId' => $prepared['account']['id'] ?? null,
            ],
            'rawPaymentResponse' => null,
        ];

        $orders[] = $order;
        $this->writeJsonArray('alibaba-purchase-orders.json', $orders);

        return ['order' => $order];
    }

    public function payPurchaseOrder(string $orderId, string $action): array
    {
        $orders = $this->readJsonArray('alibaba-purchase-orders.json');
        $updatedOrder = null;
        $now = $this->nowIso();
        $account = $this->resolveLiveAccount(null, true);
        if ($account === null) {
            throw new RuntimeException('Aucun compte AliExpress connecte n\'est disponible pour le paiement DS live.');
        }

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
                $order['paymentStatus'] = $isPaid ? 'paid' : ($isFailed ? 'failed' : ($payUrl ? 'pay_url_generated' : 'pending'));
                $order['orderStatus'] = $isPaid ? 'paid' : ($isFailed ? 'failed' : 'payment_pending');
                $order['payFailureReason'] = $isFailed ? ($payFailureReason ?? 'Paiement non complete') : null;
                $order['rawPaymentResponse'] = $paymentResult['responseBody'];
            } else {
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
                    $payment = $this->openPlatform->queryPaymentResult($result['account'], $tradeId);
                    $this->persistResolvedLiveAccount($payment['account']);
                    $paymentResult = $payment['result'];
                    $remoteStatus = strtoupper(trim((string) ($this->openPlatform->extractTradeOrderStatus($paymentResult['responseBody']) ?? '')));
                    $payUrl = $this->openPlatform->extractTradePayUrl($paymentResult['responseBody']);
                    $isPaid = in_array($remoteStatus, ['FINISH', 'PAID'], true);
                    $isFailed = str_contains($remoteStatus, 'CANCEL') || str_contains($remoteStatus, 'CLOSE') || str_contains($remoteStatus, 'FAIL');
                    $order['payUrl'] = $payUrl;
                    $order['paymentStatus'] = $isPaid ? 'paid' : ($isFailed ? 'failed' : ($payUrl ? 'pay_url_generated' : 'pending'));
                    $order['orderStatus'] = $isPaid ? 'paid' : ($isFailed ? 'failed' : 'payment_pending');
                    $order['rawPaymentResponse'] = $paymentResult['responseBody'];
                    if ($isFailed && $order['payFailureReason'] === null) {
                        $order['payFailureReason'] = $this->openPlatform->extractOperationMessageFromResponse($paymentResult['responseBody']) ?? 'Paiement non complete';
                    }
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

    private function normalizePanel(?string $panel): string
    {
        $candidate = is_string($panel) ? trim($panel) : '';

        return in_array($candidate, self::PANEL_SLUGS, true) ? $candidate : 'dashboard';
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
                : "Le backend Laravel repond bien pour AliExpress, mais aucune persistance base de donnees exploitable n'a ete detectee pour ce module. Verifie la configuration MySQL Hostinger cote backend.",
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
        $title = $this->stringOrFallback($source['title'] ?? $source['shortTitle'] ?? null, 'Produit AliExpress');
        $shortTitle = $this->stringOrFallback($source['shortTitle'] ?? null, $title);
        $gallery = $this->normalizeGallery($source['gallery'] ?? null, $source['image'] ?? $source['imageUrl'] ?? null);
        $rawPayload = is_array($source['rawPayload'] ?? null) ? $source['rawPayload'] : $source;
        $campaignMode = $this->stringOrNull($input['campaignMode'] ?? null);
        if ($campaignMode !== null) {
            $rawPayload['afripayCampaign'] = ['mode' => $campaignMode];
        }

        return [
            'id' => (string) Str::uuid(),
            'sourceProductId' => $sourceProductId,
            'categorySlug' => $this->stringOrNull($source['categorySlug'] ?? $source['categoryId'] ?? null),
            'categoryTitle' => $this->stringOrNull($source['categoryTitle'] ?? null),
            'categoryPath' => $this->normalizeStringArray($source['categoryPath'] ?? null),
            'slug' => $this->slugify($this->stringOrFallback($source['slug'] ?? null, $shortTitle.'-'.$sourceProductId)),
            'title' => $title,
            'shortTitle' => $shortTitle,
            'description' => $this->stringOrFallback($source['description'] ?? null, $title),
            'query' => $this->stringOrFallback($input['manualSeedQuery'] ?? $input['query'] ?? null, $sourceProductId),
            'keywords' => $this->normalizeStringArray($source['keywords'] ?? null),
            'image' => $this->stringOrFallback($source['image'] ?? $source['imageUrl'] ?? ($gallery[0] ?? null), '/globe.svg'),
            'gallery' => $gallery,
            'videoUrl' => $this->stringOrNull($source['videoUrl'] ?? null),
            'videoPoster' => $this->stringOrNull($source['videoPoster'] ?? null),
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
            'supplierName' => $this->stringOrFallback($source['supplierName'] ?? null, 'AliExpress Supplier'),
            'supplierLocation' => $this->stringOrFallback($source['supplierLocation'] ?? null, 'China'),
            'supplierCompanyId' => $this->stringOrNull($source['supplierCompanyId'] ?? null),
            'responseTime' => $this->stringOrFallback($source['responseTime'] ?? null, '24h'),
            'yearsInBusiness' => $this->toInt($source['yearsInBusiness'] ?? 1),
            'transactionsLabel' => $this->stringOrFallback($source['transactionsLabel'] ?? null, 'Transactions verifiees'),
            'soldLabel' => $this->stringOrFallback($source['soldLabel'] ?? null, 'Best seller'),
            'customizationLabel' => $this->stringOrFallback($source['customizationLabel'] ?? null, 'Personnalisation disponible'),
            'shippingLabel' => $this->stringOrFallback($source['shippingLabel'] ?? null, 'Expedition internationale'),
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
        $metadata = [
            'shortTitle' => $item['shortTitle'] ?? $item['title'],
            'videoUrl' => $item['videoUrl'] ?? null,
            'videoPoster' => $item['videoPoster'] ?? null,
            'maxUsd' => $item['maxUsd'] ?? null,
            'moqVerified' => $item['moqVerified'] ?? true,
            'packaging' => $item['packaging'] ?? 'Carton',
            'itemWeightGrams' => $item['itemWeightGrams'] ?? 0,
            'lotCbm' => $item['lotCbm'] ?? '0',
            'responseTime' => $item['responseTime'] ?? '24h',
            'yearsInBusiness' => $item['yearsInBusiness'] ?? 1,
            'transactionsLabel' => $item['transactionsLabel'] ?? 'Transactions verifiees',
            'soldLabel' => $item['soldLabel'] ?? 'Best seller',
            'customizationLabel' => $item['customizationLabel'] ?? 'Personnalisation disponible',
            'shippingLabel' => $item['shippingLabel'] ?? 'Expedition internationale',
            'overview' => $item['overview'] ?? [],
            'tiers' => $item['tiers'] ?? [],
            'variantGroups' => $item['variantGroups'] ?? [],
            'variantPricing' => $item['variantPricing'] ?? [],
            'specs' => $item['specs'] ?? [],
            'keywords' => $item['keywords'] ?? [],
            'supplierPriceFcfa' => isset($item['minUsd']) ? (int) round($this->toFloat($item['minUsd']) * 650) : 0,
        ];

        $product = Product::query()->firstOrNew([
            'source_provider' => 'aliexpress',
            'source_product_id' => (string) ($item['sourceProductId'] ?? $item['id']),
        ]);

        $product->fill([
            'title' => (string) ($item['title'] ?? 'Produit AliExpress'),
            'slug' => (string) ($item['slug'] ?? $this->slugify((string) ($item['title'] ?? 'produit-aliexpress'))),
            'description' => (string) ($item['description'] ?? $item['title'] ?? ''),
            'price' => round($this->toFloat($item['minUsd'] ?? 0), 2),
            'category' => (string) ($item['categorySlug'] ?? 'aliexpress'),
            'stock' => max(0, $this->toInt($item['inventory'] ?? 0)),
            'image' => (string) ($item['image'] ?? '/globe.svg'),
            'gallery' => is_array($item['gallery'] ?? null) ? array_values($item['gallery']) : [],
            'supplier_name' => (string) ($item['supplierName'] ?? 'AliExpress Supplier'),
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
            foreach (Product::query()->where('source_provider', 'aliexpress')->latest()->limit(200)->get() as $product) {
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
            'title' => (string) ($preview['title'] ?? $preview['shortTitle'] ?? 'Produit AliExpress'),
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
        return [
            'sourceProductId' => (string) ($product['sourceProductId'] ?? $product['id'] ?? ''),
            'shortTitle' => (string) ($product['shortTitle'] ?? $product['title'] ?? 'Produit AliExpress'),
            'title' => (string) ($product['title'] ?? 'Produit AliExpress'),
            'image' => (string) ($product['image'] ?? (($product['gallery'][0] ?? null) ?: '/globe.svg')),
            'minUsd' => $this->toFloat($product['minUsd'] ?? 0),
            'maxUsd' => $this->nullableFloat($product['maxUsd'] ?? null),
            'supplierName' => (string) ($product['supplierName'] ?? 'AliExpress Supplier'),
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
            'overview' => $product['overview'] ?? [],
            'variantPricing' => $product['variantPricing'] ?? [],
            'tiers' => $product['tiers'] ?? [],
            'specs' => $product['specs'] ?? [],
            'rawPayload' => $product['rawPayload'] ?? $product,
        ];
    }

    private function toPreviewProductFromCatalogProduct(Product $product): array
    {
        $metadata = is_array($product->metadata) ? $product->metadata : [];

        return [
            'sourceProductId' => (string) ($product->source_product_id ?: $product->slug),
            'shortTitle' => (string) ($metadata['shortTitle'] ?? $product->title),
            'title' => (string) $product->title,
            'image' => (string) ($product->image ?: (($product->gallery[0] ?? null) ?: '/globe.svg')),
            'minUsd' => (float) $product->price,
            'maxUsd' => isset($metadata['maxUsd']) ? $this->nullableFloat($metadata['maxUsd']) : null,
            'supplierName' => (string) ($product->supplier_name ?? 'AliExpress Supplier'),
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
            'overview' => $metadata['overview'] ?? [],
            'variantPricing' => $metadata['variantPricing'] ?? [],
            'tiers' => $metadata['tiers'] ?? [],
            'specs' => $metadata['specs'] ?? [],
            'rawPayload' => $metadata,
        ];
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

    private function normalizeGallery($gallery, $fallbackImage = null): array
    {
        $normalized = [];
        if (is_array($gallery)) {
            foreach ($gallery as $image) {
                $value = trim((string) $image);
                if ($value !== '') {
                    $normalized[] = $value;
                }
            }
        }

        $fallback = trim((string) $fallbackImage);
        if ($normalized === [] && $fallback !== '') {
            $normalized[] = $fallback;
        }

        if ($normalized === []) {
            $normalized[] = '/globe.svg';
        }

        return array_values(array_unique($normalized));
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

        return $slug !== '' ? $slug : 'aliexpress-'.Str::lower(Str::random(8));
    }

    private function nowIso(): string
    {
        return now()->toIso8601String();
    }

    private function buildPayUrl(string $orderId, string $action): string
    {
        $base = rtrim((string) config('app.url', 'https://api.afripay.space'), '/');

        return $base.'/admin/aliexpress-sourcing/lots?orderId='.rawurlencode($orderId).'&action='.rawurlencode($action);
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
        $guidance = 'Commande DS creee, mais l\'auto-paiement a echoue. Verifie la whitelist auto-pay (appKey), le compte acheteur AliExpress, le compte PayPal lie au buyer account, puis active Auto Pay dans AliExpress DS.';
        return $details !== '' ? $guidance.' Detail: '.$details : $guidance;
    }

    private function formatAliExpressDsOrderCreateFailure(?string $errorCode, ?string $errorMessage): string
    {
        $code = trim((string) $errorCode);
        $message = trim((string) $errorMessage);
        $normalizedMessage = strtolower($message);

        if ($code === 'ITEM_ID_NOT_FOUND') {
            return "L'article AliExpress n'existe plus ou l'identifiant produit est invalide.";
        }

        if ($code === 'Item is not allowed to this country') {
            return "Ce produit AliExpress n'est pas autorise a la vente pour le pays de destination choisi.";
        }

        if ($code === 'SKU_NOT_EXIST') {
            return "Le SKU AliExpress de ce produit n'existe plus ou n'a pas ete transmis. Reimporte l'article pour resynchroniser ses variantes avant de relancer le lot DS.";
        }

        if ($code === 'B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL') {
            if (str_contains($normalizedMessage, 'city')) {
                return 'Adresse AliExpress invalide: la ville est obligatoire ou non reconnue.';
            }

            if (str_contains($normalizedMessage, 'state') || str_contains($normalizedMessage, 'province') || str_contains($normalizedMessage, 'county')) {
                return 'Adresse AliExpress invalide: l\'etat ou la province est obligatoire.';
            }

            if (str_contains($normalizedMessage, 'phone') || str_contains($normalizedMessage, 'country code')) {
                return 'Adresse AliExpress invalide: verifie le numero de telephone et l\'indicatif pays.';
            }

            if (str_contains($normalizedMessage, '2 and 32') || str_contains($normalizedMessage, '2 to 32') || str_contains($normalizedMessage, '2-32')) {
                return 'Adresse AliExpress invalide: le nom du contact doit contenir entre 2 et 32 caracteres.';
            }

            return $message !== '' ? 'Adresse AliExpress invalide: '.$message : 'Adresse AliExpress invalide. Verifie les champs ville, province, telephone et contact.';
        }

        if ($code === 'DELIVERY_METHOD_NOT_EXIST') {
            return 'Aucune methode de livraison AliExpress valide n\'est disponible pour cette adresse.';
        }

        if ($code === 'PRICE_PAY_CURRENCY_ERROR') {
            return 'La devise de paiement AliExpress ne correspond pas a la devise du produit.';
        }

        if ($code === 'INVENTORY_HOLD_ERROR') {
            return 'AliExpress a refuse la commande: stock insuffisant ou erreur de reservation d\'inventaire.';
        }

        if ($code === 'REPEATED_ORDER_ERROR') {
            return 'AliExpress signale une commande dupliquee pour ce lot.';
        }

        if ($code === 'USER_ACCOUNT_DISABLED') {
            return 'Le compte AliExpress utilise pour le dropshipping est desactive.';
        }

        if ($code === 'BLACKLIST_BUYER_IN_LIST') {
            return 'Le compte acheteur AliExpress est temporairement bloque pour cette commande.';
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

        return is_array($decoded) ? array_values($decoded) : [];
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
}