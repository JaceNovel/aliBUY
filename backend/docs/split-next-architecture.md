# Split Frontend/Backend Next.js Architecture

## Objectif

Refactoriser l'application actuelle en deux applications Next.js distinctes sans casser les integrations existantes a la racine du depot.

- `frontend/`: UI only, App Router, aucun acces Prisma, aucune cle sensible.
- `backend/`: API only, App Router route handlers, Prisma, logique metier, paiements, Alibaba.

Pendant la migration, l'application racine continue de porter les integrations historiques. Les dossiers `frontend/` et `backend/` servent de cible propre pour la bascule progressive.

## Structure cible

```text
frontend/
  .env.example
  package.json
  next.config.ts
  src/
    app/
      layout.tsx
      page.tsx
      loading.tsx
      products/
        page.tsx
        [slug]/page.tsx
      checkout/
        page.tsx
    components/
      add-to-cart-button.tsx
      checkout-client.tsx
      product-card.tsx
      products-feed.tsx
    lib/
      api.ts
      config.ts
      types.ts
    store/
      cart-store.ts

backend/
  .env.example
  package.json
  next.config.ts
  src/
    app/
      api/
        products/
          route.ts
          [slug]/route.ts
        orders/
          route.ts
          [id]/route.ts
        payments/
          route.ts
          moneroo/
            verify/route.ts
            webhook/route.ts
          webhook/route.ts
        alibaba/
          catalog/route.ts
          mapping/route.ts
          mapping/
            [slug]/route.ts
    lib/
      cors.ts
      env.ts
      prisma.ts
      validation.ts
      repositories/
        product-repository.ts
      services/
        order-service.ts
        payment-service.ts
```

## Mappage des responsabilites

### Frontend

- pages et composants UI
- fetch HTTP vers `NEXT_PUBLIC_API_URL`
- infinite scroll et loading states
- panier local et envoi d'intentions de commande

### Backend

- validation et sanitation des payloads
- acces Prisma exclusif
- pagination `skip/take`
- adaptation catalogue Alibaba vers un contrat API stable
- creation de commandes
- initialisation paiements Moneroo et FedaPay
- verification Moneroo et webhook paiement signe
- politique CORS restrictive
- routes admin protegees par jeton pour ecriture catalogue et mappings

## Endpoints exposes

### Produits

- `GET /api/products?page=1&limit=12`
- `GET /api/products?category=electronics`
- `GET /api/products?search=chargeur`
- `GET /api/products/[slug]`
- `POST /api/products`
- `PUT /api/products/[slug]`
- `DELETE /api/products/[slug]`

Les verbes d'ecriture sur le catalogue sont proteges par `Authorization: Bearer $ADMIN_API_TOKEN` ou `x-admin-token`.

### Commandes

- `POST /api/orders`
- `GET /api/orders/[id]`

### Paiements

- `POST /api/payments?provider=moneroo`
- `POST /api/payments?provider=fedapay`
- `POST /api/payments/moneroo/verify`
- `POST /api/payments/moneroo/webhook`
- `POST /api/payments/webhook`

### Alibaba

- `GET /api/alibaba/catalog`
- `GET /api/alibaba/mapping`
- `POST /api/alibaba/mapping`
- `GET /api/alibaba/mapping/[slug]`
- `PUT /api/alibaba/mapping/[slug]`
- `DELETE /api/alibaba/mapping/[slug]`

Les verbes d'ecriture sur les mappings Alibaba sont eux aussi proteges par `ADMIN_API_TOKEN`.

## Exemple de payload commande

```json
{
  "customer": {
    "fullName": "Ada N'Dri",
    "email": "ada@example.com",
    "phone": "+2250700000000",
    "address": "Cocody Riviera 3",
    "city": "Abidjan",
    "country": "CI"
  },
  "items": [
    {
      "productId": "cm123",
      "slug": "chargeur-solaire-20000mah",
      "name": "Chargeur solaire 20000mAh",
      "price": 25000,
      "quantity": 2
    }
  ],
  "notes": "Livrer en journee"
}
```

## Exemple de fetch frontend vers backend

```ts
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products?page=1&limit=12`, {
  method: "GET",
  cache: "no-store",
});

if (!response.ok) {
  throw new Error("Backend unavailable");
}

const payload = await response.json();
```

## Prisma et donnees

Le scaffold backend branche le catalogue public sur `AlibabaImportedProductRecord` et les commandes sur `SourcingOrder`.

Cela permet:

- de reutiliser les integrations et donnees existantes
- de ne pas inventer un faux schema `Product` / `Order` absent du projet actuel
- de migrer ensuite vers des tables dediees si necessaire, sans casser l'API frontend

## Recommandations Prisma

- conserver `skip/take` pour la pagination catalogue
- garder les index deja presents sur:
  - `AlibabaImportedProductRecord.title`
  - `AlibabaImportedProductRecord.categorySlug`
  - `AlibabaImportedProductRecord.createdAt`
- si vous introduisez une table `Product` dediee plus tard, recreer au minimum les index:
  - `@@index([title])`
  - `@@index([category])`
  - `@@index([createdAt])`

## Variables d'environnement

### Backend

Fichier: `backend/.env`

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alibuy_backend?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
FRONTEND_ORIGIN="http://localhost:3000"
ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
MONEROO_API_URL="https://api.moneroo.example"
MONEROO_SECRET_KEY="replace-me"
MONEROO_WEBHOOK_SECRET="replace-me"
FEDAPAY_API_URL="https://api.fedapay.example"
FEDAPAY_API_KEY="replace-me"
PAYMENT_WEBHOOK_SECRET="replace-me"
ALIBABA_APP_KEY="replace-me"
ALIBABA_APP_SECRET="replace-me"
ALIBABA_ACCESS_TOKEN="replace-me"
ADMIN_API_TOKEN="replace-me"
ALIBABA_MAPPING_PATH="/opt/render/project/src/data/sourcing/catalog-mapping.json"
```

### Frontend

Fichier: `frontend/.env`

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## Demarrage local

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:3000`

Backend: `http://localhost:3001`

## Render.com

### Service backend

- Type: Web Service
- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Runtime: Node

Variables backend minimales:

- `DATABASE_URL`
- `FRONTEND_ORIGIN`
- `ALLOWED_ORIGINS`
- `MONEROO_API_URL`
- `MONEROO_SECRET_KEY`
- `MONEROO_WEBHOOK_SECRET`
- `FEDAPAY_API_URL`
- `FEDAPAY_API_KEY`
- `PAYMENT_WEBHOOK_SECRET`
- `ALIBABA_APP_KEY`
- `ALIBABA_APP_SECRET`
- `ALIBABA_ACCESS_TOKEN`
- `ADMIN_API_TOKEN`

## Notes de migration

- Le backend split persiste maintenant les mappings Alibaba dans Prisma via `AlibabaCatalogMappingRecord`.
- Le fichier historique `data/sourcing/catalog-mapping.json` reste synchronise en sortie pour ne pas casser la racine du depot pendant la bascule.
- Moneroo utilise les memes endpoints et la meme logique de verification qu'a la racine, mais isoles dans `backend/`.
- FedaPay reste annonce dans le contrat d'API mais n'a pas encore d'adaptateur reel porte depuis la racine.

### Service frontend

- Type: Web Service
- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Runtime: Node

Variable frontend minimale:

- `NEXT_PUBLIC_API_URL=https://votre-backend.onrender.com`

## Strategie de migration progressive

1. Garder l'application racine en production tant que `frontend/` et `backend/` ne couvrent pas le flux complet.
2. Brancher d'abord `frontend/` sur `backend/` pour le catalogue et le checkout simple.
3. Migrer ensuite les integrations critiques:
   - verification paiement Moneroo
   - initialisation FedaPay reelle
   - mapping Alibaba persistant
   - CRUD admin protege
4. Basculer le domaine public vers `frontend/`.
5. Limiter ensuite l'application racine aux outils internes ou la decomissionner.

## Points a terminer avant production

- authentification admin et RBAC sur les routes d'ecriture
- persistance reelle des mappings Alibaba
- webhooks Moneroo/FedaPay relies a une mise a jour commande
- durcissement validation entree via Zod ou Valibot
- rate limiting et logs structures
- tests d'integration API
