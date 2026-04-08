# Import AliExpress Par ID Produit

Ce document decrit le flux reel de ce depot pour importer un produit AliExpress a partir de son identifiant produit (`external product ID`) ou d'une URL produit contenant cet ID.

Il correspond au code actuel en `Next.js / TypeScript`, pas a un flux Laravel/PHP.

## Objectif

Le flux d'import exact fait maintenant 4 choses :

1. l'admin saisit un `product_id` AliExpress exact ou une URL produit
2. le frontend appelle un endpoint d'aperçu distant `fetch-remote`
3. le backend tente de charger la fiche distante avec plusieurs strategies et la normalise
4. si la fiche est exploitable, l'import local reutilise ce snapshot normalise pour la persistence

## Point d'entree front

L'ecran d'import catalogue est rendu via :

- [page.tsx](/home/kernelx/aliBUY/frontend/src/app/admin/aliexpress-sourcing/page.tsx)
- [page.tsx](/home/kernelx/aliBUY/frontend/src/app/admin/aliexpress-sourcing/[panel]/page.tsx)
- [admin-alibaba-operations-client.tsx](/home/kernelx/aliBUY/frontend/src/components/admin-alibaba-operations-client.tsx)

Le vrai composant de travail est :

- [admin-alibaba-operations-client.tsx](/home/kernelx/aliBUY/frontend/src/components/admin-alibaba-operations-client.tsx)

Dans ce composant :

- `manualProductMode` active l'import exact par ID produit
- `extractAliExpressProductIdFromInput()` extrait un ID depuis une saisie libre ou une URL
- `selectedImportSupplierAccountId` permet de choisir explicitement le compte fournisseur OAuth a utiliser

Extrait cle :

```tsx
const manualProductId = useMemo(
  () => activeImportForm.manualProductMode ? extractAliExpressProductIdFromInput(activeImportForm.query) : "",
  [activeImportForm.manualProductMode, activeImportForm.query],
);
```

Puis le bouton d'import appelle la route backend :

```tsx
await fetch(buildApiUrl("/api/admin/aliexpress/import"), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    query: activeImportForm.manualProductMode ? manualProductId : activeImportForm.query,
    limit: activeImportForm.manualProductMode ? 1 : activeImportForm.limit,
    supplierAccountId: importSupplierAccount.id,
    fulfillmentChannel: activeImportForm.fulfillmentChannel,
    campaignMode: activeImportForm.campaignMode,
    autoPublish: activeImportForm.autoPublish,
    resetImportedProducts: activeImportForm.resetImportedProducts,
    manualProductMode: activeImportForm.manualProductMode,
    destinationCountry: selectedCountryCode,
    targetCurrency: selectedCurrencyCode,
    targetLanguage: selectedLanguageCode,
  }),
});
```

En mode manuel, le front passe d'abord par une etape d'aperçu distant :

```tsx
const previewResponse = await fetchAdminAliExpress("/api/admin/aliexpress/fetch-remote", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    query: activeImportForm.query,
    supplierAccountId: importSupplierAccount.id,
    destinationCountry: "FR",
    targetCurrency: "USD",
    targetLanguage: "fr_FR",
  }),
});
```

Si l'aperçu reussit, le produit normalise est reinjecte dans la vraie requete d'import :

```tsx
body: JSON.stringify({
  ...activeImportForm,
  query: manualProductId,
  limit: 1,
  supplierAccountId: importSupplierAccount.id,
  prefetchedProduct,
> Note architecture 2026-04-08
>
> Les chemins `backend/src/...` mentionnes dans ce document appartenaient a l'ancien backend Next.js et n'existent plus.
> Le backend actif est maintenant Laravel sous `backend/app`, `backend/routes` et `backend/app/Services`.

  prefetchedDebug,
})
```

## Route backend

Les routes d'import sont :

- [route.ts](/home/kernelx/aliBUY/backend/src/app/api/admin/aliexpress/fetch-remote/route.ts)
- [route.ts](/home/kernelx/aliBUY/backend/src/app/api/admin/aliexpress/import/route.ts)

La route `fetch-remote` :

1. valide implicitement la presence d'un `product_id` ou d'une URL contenant cet ID
2. appelle `fetchAlibabaRemoteExactProduct()`
3. renvoie soit un `product` normalise, soit un `400` avec `debug`

La route `import` :

1. normalise les parametres
2. peut recevoir `prefetchedExactProduct` et `prefetchedExactDebug`
3. transmet la requete au service principal `runAlibabaCatalogImport()`
4. renvoie un `400` avec un bloc `debug` si l'import exact echoue

Extrait cle :

```ts
const result = await runAlibabaCatalogImport({
  query: String(body?.query ?? ""),
  limit: Number(body?.limit ?? 12),
  fulfillmentChannel: normalizeFulfillmentChannel(body?.fulfillmentChannel),
  autoPublish: campaignMode === "free-deal" ? true : Boolean(body?.autoPublish),
  campaignMode,
  resetImportedProducts: Boolean(body?.resetImportedProducts),
  manualProductMode: Boolean(body?.manualProductMode),
  destinationCountry: body?.destinationCountry ?? body?.destination_country,
  targetCurrency: body?.targetCurrency ?? body?.target_currency,
  targetLanguage: body?.targetLanguage ?? body?.target_language,
  provinceCode: body?.provinceCode ?? body?.province_code,
  cityCode: body?.cityCode ?? body?.city_code,
  supplierAccountId: body?.supplierAccountId ?? body?.supplier_account_id,
});
```

## Service principal

Le coeur du flux est :

- [alibaba-operations-service.ts](/home/kernelx/aliBUY/backend/src/lib/alibaba-operations-service.ts)

Fonction principale :

- `runAlibabaCatalogImport()`

Nouvelle fonction dediee a l'etape distante :

- `fetchAlibabaRemoteExactProduct()`

### Detection du mode import exact

Le service detecte un `product_id` numerique et active le flux exact si `manualProductMode` est vrai :

```ts
const normalizedQuery = input.query.trim();
const directProductIdMatch = normalizedQuery.match(/(?:^|\D)(\d{12,20})(?:\D|$)/);
const manualDirectImport = Boolean(input.manualProductMode);
```

Validation :

- si le mode manuel est actif sans saisie, erreur
- si le mode manuel est actif sans `product_id` numerique detecte, erreur

### Etape 1 : chargement distant exact

Le service expose maintenant une fonction dediee :

- `fetchAlibabaRemoteExactProduct()`

Cette fonction :

1. valide l'ID ou l'URL
2. derive `destinationCountry`, `targetCurrency`, `targetLanguage`
3. appelle `fetchAlibabaProductSnapshotWithDebug()`
4. renvoie un resultat uniforme avec :
   - `ok`
   - `endpoint`
   - `sourceProductId`
   - `product`
   - `errorMessage`
   - `debug`

Extrait cle :

```ts
const remoteFetchResult = await fetchAlibabaRemoteExactProduct({
  query: normalizedQuery,
  destinationCountry,
  targetCurrency,
  targetLanguage,
  provinceCode,
  cityCode,
  supplierAccountId: input.supplierAccountId,
});
```

### Etape 2 : import local

Dans `runAlibabaCatalogImport()`, le mode manuel reutilise maintenant :

- `prefetchedExactProduct` si le frontend l'a deja charge
- sinon `fetchAlibabaRemoteExactProduct()` directement

Extrait simplifie :

```ts
const remoteFetchResult = prefetchedExactProduct
  ? { ok: true, product: prefetchedExactProduct, debug: prefetchedExactDebug, ... }
  : await fetchAlibabaRemoteExactProduct({ ... });
```

Si aucun produit exploitable n'est reconstruit, le service leve une erreur enrichie avec `debug`.

## Client AliExpress / Open Platform

Le chargeur distant reel est :

- [alibaba-open-platform-client.ts](/home/kernelx/aliBUY/backend/src/lib/alibaba-open-platform-client.ts)

Fonction principale :

- `fetchAlibabaProductSnapshotWithDebug()`

## Ordre reel des tentatives distantes

Pour un import exact par `product_id`, le backend essaie dans cet ordre :

1. `aliexpress.ds.product.get`
2. `aliexpress.ds.product.wholesale.get`
3. `aliexpress.public.product.page`

Le compte fournisseur selectionne est force via :

```ts
const credentials = await resolveAlibabaCredentialsForLiveCall({ accountId: input.supplierAccountId });
```

Donc l'import exact utilise bien le compte OAuth choisi dans l'UI.

## Tentative 1 : DS Product

Le backend appelle `getAlibabaIcbuProduct()` avec :

```ts
{
  productId: input.sourceProductId,
  shipToCountry: context.shipToCountry,
  targetCurrency: context.currency,
  targetLanguage: context.local,
  provinceCode: input.provinceCode,
  cityCode: input.cityCode,
}
```

Si la reponse est exploitable, elle est mappee via :

- `mapAliExpressProductDetailToProduct()`

Mode debug final :

- `resolvedRemoteMode = "ds_product"`

## Tentative 2 : DS Wholesale

Le backend appelle `getAlibabaIcbuWholesaleProduct()` avec les memes contextes pays / langue / devise.

Si la reponse est exploitable :

- `resolvedRemoteMode = "ds_wholesale"`
- `fallbackUsed = true`

## Tentative 3 : Public Product Page

Si toutes les strategies API precedentes echouent, le backend tente maintenant un fallback page publique :

- `fetchAliExpressPublicProductSnapshot()`

Ce fallback :

1. construit une ou plusieurs URLs du type `https://fr.aliexpress.com/item/{id}.html`
2. telecharge la page publique
3. tente d'extraire du JSON embarque, des metas HTML, les images, le prix et des variantes publiques
4. reconstruit un `AlibabaSearchProduct` minimal si possible

Mode debug final :

- `resolvedRemoteMode = "public_product_page"`

Endpoint debug affiche :

- `aliexpress.public.product.page`

Important :

- ce fallback n'utilise pas l'API affiliate
- il sert a sauver une fiche fournisseur minimale quand l'API DS ne renvoie pas de SKU exploitables
- il ne garantit pas a lui seul la possibilite de passer ensuite une commande AliExpress automatisee

## Mapping en produit fournisseur local

Quand une tentative distante reussit, le resultat est normalise en `AlibabaSearchProduct`.

Le mapper principal DS / standard est :

- `mapAliExpressProductDetailToProduct()`

Ce mapper construit notamment :

- `sourceProductId`
- `title`
- `shortTitle`
- `image`
- `gallery`
- `minUsd`
- `maxUsd`
- `moq`
- `packageDimensionsCm`
- `itemWeightGrams`
- `variantGroups`
- `variantPricing`
- `variantSkus`
- `tiers`
- `specs`
- `rawPayload`

Extrait simplifie :

```ts
return {
  sourceProductId,
  slug: sourceProductId,
  title,
  shortTitle: title.slice(0, 96),
  image: primaryImage,
  gallery,
  packageDimensionsCm,
  itemWeightGrams: weightGrams ?? 0,
  minUsd,
  maxUsd,
  moq,
  supplierName,
  variantGroups,
  variantPricing,
  variantSkus,
  tiers,
  specs,
  rawPayload: {
    provider: "aliexpress-ds",
    search: searchItem,
    detail: detailResponseBody,
  },
};
```

## Filtrage avant import local

Avant d'enregistrer le produit importe, le service garde seulement les produits ayant les donnees minimales requises :

```ts
const productsWithRequiredData = uniqueSearchProducts.filter((product) => product.priceVerified
  && product.moqVerified
  && product.itemWeightGrams > 0
  && typeof product.image === "string"
  && product.image.length > 0
  && !!product.packageDimensionsCm
  && product.packageDimensionsCm.lengthCm > 0
  && product.packageDimensionsCm.widthCm > 0
  && product.packageDimensionsCm.heightCm > 0);
```

Donc, meme si une fiche distante existe, elle n'est pas importee localement si elle n'a pas au minimum :

- un prix verifie
- un MOQ verifie
- un poids > 0
- une image
- des dimensions colis valides

## Enregistrement local

Les produits importes sont ensuite persistes via les fonctions de store utilisees par le service Alibaba Operations.

Le flux local ne cree pas un objet Laravel `SupplierProduct`.

Ici, on alimente plutot :

- les jobs d'import AliExpress
- les produits importes locaux
- les produits potentiellement publies sur le site si `autoPublish` est actif

Les structures locales sont definies dans :

- [alibaba-operations.ts](/home/kernelx/aliBUY/backend/src/lib/alibaba-operations.ts)

Les acces store et la persistence passent par :

- [alibaba-operations-store.ts](/home/kernelx/aliBUY/backend/src/lib/alibaba-operations-store.ts)

## Diagnostic d'erreur

Quand le snapshot exact echoue, le backend renvoie un `debug` structure avec :

- `externalProductId`
- `shipToCountry`
- `targetCurrency`
- `targetLanguage`
- `attempts`
- `resolvedRemoteMode`
- `fallbackUsed`
- `providerRequestId`
- `responseShape`

L'UI affiche ensuite ce diagnostic dans :

- [admin-alibaba-operations-client.tsx](/home/kernelx/aliBUY/frontend/src/components/admin-alibaba-operations-client.tsx)

La logique de message humain est centralisee dans :

- `resolveAlibabaManualImportErrorMessage()`

## Exemple minimal de requete reelle

L'aperçu distant passe par :

```http
POST /api/admin/aliexpress/fetch-remote
Content-Type: application/json

{
  "query": "https://fr.aliexpress.com/item/1005010812705425.html",
  "supplierAccountId": "supplier-account-id",
  "destinationCountry": "FR",
  "targetCurrency": "USD",
  "targetLanguage": "fr_FR"
}
```

Puis l'import exact passe par :

```http
POST /api/admin/aliexpress/import
Content-Type: application/json

{
  "query": "1005010812705425",
  "limit": 1,
  "manualProductMode": true,
  "supplierAccountId": "supplier-account-id",
  "prefetchedProduct": { "...": "snapshot normalise" },
  "prefetchedDebug": { "...": "diagnostic exact" },
  "fulfillmentChannel": "crossborder",
  "campaignMode": "standard",
  "autoPublish": false,
  "destinationCountry": "FR",
  "targetCurrency": "USD",
  "targetLanguage": "fr_FR"
}
```

## Resume technique

Le code principal qui permet l'import AliExpress par ID produit dans ce repo est :

- [admin-alibaba-operations-client.tsx](/home/kernelx/aliBUY/frontend/src/components/admin-alibaba-operations-client.tsx) pour la saisie, l'extraction de l'ID et le choix du compte fournisseur
- [route.ts](/home/kernelx/aliBUY/backend/src/app/api/admin/aliexpress/fetch-remote/route.ts) pour l'aperçu distant exact
- [route.ts](/home/kernelx/aliBUY/backend/src/app/api/admin/aliexpress/import/route.ts) pour l'entree API admin
- [alibaba-operations-service.ts](/home/kernelx/aliBUY/backend/src/lib/alibaba-operations-service.ts) pour la separation entre chargement distant exact et persistence locale
- [alibaba-open-platform-client.ts](/home/kernelx/aliBUY/backend/src/lib/alibaba-open-platform-client.ts) pour les appels AliExpress et les fallbacks
- [alibaba-operations-store.ts](/home/kernelx/aliBUY/backend/src/lib/alibaba-operations-store.ts) pour la persistence locale

## Notes importantes

- ce depot a maintenant une route `fetch-remote` separee pour l'aperçu exact
- l'import exact final passe toujours par `/api/admin/aliexpress/import`
- le compte fournisseur selectionne dans l'UI est bien pris en compte
- cette app est traitee comme `dropshipping only`
- les APIs `affiliate` et `aliexpress.solution.product.info.get` ne font plus partie du flux principal d'import produit
- le vrai blocage observe actuellement vient surtout des reponses `result_without_skus` sur les endpoints DS
- le fallback `public_product_page` est un filet de securite pour les fiches publiques, pas un remplacement complet d'une vraie reponse DS
