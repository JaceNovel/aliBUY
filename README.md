This repository is prepared for a split deployment:

- Frontend: Next.js app in `frontend/`
- Backend: API and server logic in `backend/`

Root aliases still exist for compatibility:

- `src -> frontend/src`
- `public -> frontend/public`
- `data -> backend/data`
- `database -> backend/database`
- `prisma -> backend/prisma`

## Stack

- Frontend: Next.js 16 App Router + React 19
- Backend today: mixed Next.js Route Handlers + progressive Laravel extraction
- Target backend: Laravel 11 API only
- ORM: Prisma 6.16.x
- Database target: PostgreSQL via Prisma datasource
- Production persistence: PostgreSQL for users, favorites, quotes, support conversations, and authenticated orders
- Local fallback persistence kept only for sourcing admin bootstrap data under `data/sourcing/*.json`

## Progressive Split

Already migrated toward the external API layer:

- Product listing page `/products`
- Product detail page `/products/[slug]`
- Product view tracking
- Checkout order creation
- Moneroo payment initialization and verification

Current API client:

- `src/lib/api.ts`

Laravel scaffold:

- `backend/laravel`

Still local for now to avoid UX regressions during the progressive migration:

- account/session flows
- favorites
- address book
- quote/support utilities
- geolocation helper routes
- promo preview helper route

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start the frontend:

```bash
npm run dev:frontend
```

Frontend runs on `http://localhost:3000`.

3. Start the backend:

```bash
npm run dev:backend
```

Backend runs on `http://localhost:4000`.

## Deployment

- Deploy the storefront on Vercel from the repository root.
- Deploy the backend on Render with Docker.
- `frontend/` remains the visual storefront source folder.
- `backend/` remains the application/backend service source folder.
- Do not deploy local build artifacts like `.next/`, `.clerk/`, or `tmp/`.
- Render backend deployment is prepared with:
  - `Dockerfile.backend`
  - `render.yaml`
- Vercel storefront deployment is prepared with:
  - `vercel.json`

Useful commands:

```bash
npm run build:frontend
npm run build:backend
npm run prisma:generate
npm run prisma:push
```

## Admin Access

Admin routes under `/admin` are protected by a dedicated login page at `/admin/login`.
User routes under `/account`, `/checkout`, `/orders`, `/messages`, `/quotes`, and `/favorites` require a valid user session.

Environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH` is a SHA-256 password hash
- `ADMIN_SESSION_SECRET`
- `USER_SESSION_SECRET`

No admin fallback credentials are injected at runtime anymore. Configure all admin variables explicitly before deployment.

## Sourcing System

Implemented business rules:

- Air shipping: `10 000 FCFA / kg`
- Sea shipping real cost: `180 000 FCFA / CBM`
- Sea shipping sell price: `210 000 FCFA / CBM`
- Free air shipping threshold: `15 000 FCFA`
- Default shipping decision:
	- `<= 1 kg`: air
	- `> 1 kg`: air and sea shown
- Default margin is persisted server-side and configurable from admin.

Main files:

- Pricing and logistics engine: `src/lib/alibaba-sourcing.ts`
- Server-side catalog-backed sourcing quote engine: `src/lib/alibaba-sourcing-server.ts`
- Persistence and repositories: `src/lib/sourcing-store.ts`
- Business workflow: `src/lib/sourcing-service.ts`
- User and customer persistence: `src/lib/user-store.ts`, `src/lib/customer-data-store.ts`
- Alibaba server integration: `src/lib/alibaba-open-platform-client.ts`
- Prisma schema: `prisma/schema.prisma`
- SQL schema and seed: `database/mysql/schema.sql`, `database/mysql/seed.sql`
- Bootstrap sourcing data: `data/sourcing/`

## Admin and Checkout

- Admin sourcing dashboard: `/admin/aliexpress-sourcing`
- Cart: `/cart`
- Checkout sourcing: `/checkout`
- Moneroo payment page: `/orders/payment?orderId=<sourcing-order-id>`

The checkout creates an internal sourcing order, computes freight, prepares supplier order creation via Alibaba Open Platform, then redirects to a Moneroo-backed payment page.

## Moneroo Integration

Required environment variables:

- `MONEROO_SECRET_KEY`
- `MONEROO_WEBHOOK_SECRET`
- `MONEROO_API_BASE_URL` optional, defaults to `https://api.moneroo.io`
- `MONEROO_PAYMENT_METHODS` optional comma-separated list, for example `card_xof,orange_ci`

Implemented routes:

- `POST /api/payments/moneroo/initialize`
- `POST /api/payments/moneroo/verify`
- `POST /api/payments/moneroo/webhook`

Notes:

- Configure Moneroo to redirect back to your site through the `return_url` sent during initialization.
- Configure the webhook URL in Moneroo dashboard to point to `/api/payments/moneroo/webhook`.
- Payment status is persisted on sourcing orders using the Moneroo payment id and latest verification payload.

## AliExpress Integration

The server integration is ready for:

- Freight verification via `/order/freight/calculate`
- Supplier order creation via `/buynow/order/create`

Required environment variables:

- `ALIEXPRESS_OPEN_PLATFORM_APP_KEY`
- `ALIEXPRESS_OPEN_PLATFORM_APP_SECRET`
- `ALIEXPRESS_OPEN_PLATFORM_ACCESS_TOKEN`
- `ALIEXPRESS_OPEN_PLATFORM_REFRESH_TOKEN`
- `ALIEXPRESS_DS_WEBHOOK_APP_KEY`
- `ALIEXPRESS_DS_WEBHOOK_SECRET`
- `ALIEXPRESS_DS_WEBHOOK_URL`
- `ALIEXPRESS_SELLER_CALLBACK_URL`

Important:

- Real upstream calls also require valid catalog mapping data in `data/sourcing/catalog-mapping.json`
- If credentials or mappings are missing, the system creates the internal order and logs the AliExpress step as skipped instead of failing the checkout.

## Vercel Deployment

Required environment variables on Vercel:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ALIEXPRESS_PROVIDER`
- `NEXT_PUBLIC_DEFAULT_DELIVERY_COUNTRY`

Deployment notes:

- Connect the repository root to Vercel. The root Next.js app uses the storefront files through the compatibility links already present in the repo.
- `npm run build` builds the storefront app only.
- Point `NEXT_PUBLIC_API_BASE_URL` to the public Render backend URL.

## Notes

- If `DATABASE_URL` is not set, only the sourcing bootstrap layer still falls back to JSON persistence for local admin data.
- The current Prisma schema is configured for PostgreSQL because the active database endpoint is PostgreSQL.
- The repo currently contains other unrelated work-in-progress changes; they were not reverted.
