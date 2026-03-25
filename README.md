This is a Next.js 16 marketplace with a sourcing, pricing, and logistics layer for importing products from Alibaba and reselling them in Africa in FCFA.

## Stack

- Frontend: Next.js 16 App Router + React 19
- Backend: Route Handlers inside Next.js
- ORM: Prisma 6.16.x
- Database target: PostgreSQL via Prisma datasource
- Production persistence: PostgreSQL for users, favorites, quotes, support conversations, and authenticated orders
- Local fallback persistence kept only for sourcing admin bootstrap data under `data/sourcing/*.json`

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file and adjust values:

```bash
cp .env.example .env
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Configure `DATABASE_URL` and push the schema:

```bash
npm run prisma:push
```

5. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

- Admin sourcing dashboard: `/admin/alibaba-sourcing`
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

## Alibaba Integration

The server integration is ready for:

- Freight verification via `/order/freight/calculate`
- Supplier order creation via `/buynow/order/create`

Required environment variables:

- `ALIBABA_OPEN_PLATFORM_APP_KEY`
- `ALIBABA_OPEN_PLATFORM_APP_SECRET`
- `ALIBABA_OPEN_PLATFORM_ACCESS_TOKEN`

Important:

- Real upstream calls also require valid catalog mapping data in `data/sourcing/catalog-mapping.json`
- If credentials or mappings are missing, the system creates the internal order and logs the Alibaba step as skipped instead of failing the checkout.

## Vercel Deployment

Required environment variables on Vercel:

- `DATABASE_URL`
- `USER_SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `MONEROO_SECRET_KEY`
- `MONEROO_WEBHOOK_SECRET`
- `ALIBABA_OPEN_PLATFORM_APP_KEY`
- `ALIBABA_OPEN_PLATFORM_APP_SECRET`
- `ALIBABA_OPEN_PLATFORM_ACCESS_TOKEN`

Deployment notes:

- `postinstall` now runs `prisma generate`, which is required on Vercel builds.
- `npm run build` only builds the Next.js app. Apply schema changes separately with `npm run deploy:db` or your CI/CD pipeline before switching traffic.
- Run `npm run prisma:push` once against the production database before the first deployment if you are bootstrapping from the current schema instead of replaying migrations.
- The storefront no longer reads user accounts, favorites, quotes, or support threads from local JSON files.

## Notes

- If `DATABASE_URL` is not set, only the sourcing bootstrap layer still falls back to JSON persistence for local admin data.
- The current Prisma schema is configured for PostgreSQL because the active database endpoint is PostgreSQL.
- The repo currently contains other unrelated work-in-progress changes; they were not reverted.
