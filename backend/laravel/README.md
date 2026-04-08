# AfriPay Laravel API

Ce dossier contient le backend Laravel destiné a remplacer les API routes Next.js, sans changer le frontend Next.js deja en place.

## Objectif

- conserver les routes HTTP existantes cote frontend autant que possible
- conserver des formes JSON compatibles pour les domaines critiques
- isoler la logique serveur dans une API Laravel claire, securisee et deployable sur VPS

## Stack

- Laravel 13
- PHP 8.3
- Laravel Sanctum pour l'auth API
- MySQL
- Moneroo comme provider de paiement principal
- FedaPay prepare comme extension future
- Deploiement cible: Hostinger VPS + Nginx + PHP-FPM

## Surface API actuelle

### Sante

- `GET /api/test/ping`

### Authentification

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Produits et catalogue

- `GET /api/products`
- `GET /api/products/featured`
- `GET /api/products/search?q=...`
- `GET /api/products/categories`
- `GET /api/products/categories/{slug}`
- `GET /api/products/{slug}`
- `GET /api/products/{slug}/related`
- `POST /api/products/{slug}/view`
- `POST /api/products`
- `PUT /api/products/{slug}`
- `DELETE /api/products/{slug}`
- `GET /api/catalog/products`
- `GET /api/catalog/categories`

### Commandes

- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/{order}`
- `POST /api/orders/{order}/promo`

### Paiements

- `POST /api/payments/init`
- `POST /api/payments/verify`
- `POST /api/payments/webhook`
- `POST /api/payments/moneroo/webhook`

### Compte client

- `GET /api/users`
- `GET /api/users/me`
- `GET /api/account/session`
- `GET /api/account/settings`
- `PATCH /api/account/settings`
- `GET /api/account/addresses`
- `POST /api/account/addresses`
- `PUT /api/account/addresses/{address}`
- `PATCH /api/account/addresses/{address}`
- `DELETE /api/account/addresses/{address}`

Les routes suivantes sont protegees par `auth:sanctum`:

- logout
- orders
- payments init/verify
- users/account/settings/addresses

## Contrats de reponse a conserver

Les controllers et services Laravel ont ete structures pour conserver les cles deja consommees par le frontend quand elles sont critiques, notamment:

- commandes: `order`, `orders`, `promoDiscountLabel`, `totalPriceFcfa`
- paiements: `paymentId`, `checkoutUrl`, `paymentStatus`, `payment`, `monerooPaymentId`, `monerooCheckoutUrl`
- session utilisateur: `/api/users`, `/api/users/me`, `/api/account/session`

Cette couche n'est pas encore une reprise exhaustive de toutes les anciennes API Next.js. Les domaines les plus sensibles couverts a ce stade sont produits, commandes, paiements et compte client.

## Structure applicative

- `app/Http/Controllers`: expose les endpoints REST
- `app/Services`: porte la logique metier et l'integration paiement
- `app/Models`: modeles Eloquent
- `database/migrations`: schema MySQL versionne
- `config/services.php`: providers externes et URLs frontend
- `config/cors.php`: CORS frontend stateful
- `config/sanctum.php`: auth API et cookies stateful
- `deploy/nginx/afripay-api.conf`: base Nginx pour le VPS

## Installation locale

```bash
cd backend/laravel
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

## Variables d'environnement

Voir `.env.example` pour la liste complete. Les variables principales sont:

```env
APP_URL=https://api.afripay.space

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=afripay
DB_USERNAME=afripay
DB_PASSWORD=

SESSION_DOMAIN=.afripay.space
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=none
SANCTUM_STATEFUL_DOMAINS=www.afripay.space,afripay.space,localhost:3000
FRONTEND_URL=https://www.afripay.space
FRONTEND_URLS=https://www.afripay.space,https://afripay.space

PAYMENT_PROVIDER=moneroo
PAYMENT_RETURN_URL=https://www.afripay.space/orders
PAYMENT_CANCEL_URL=https://www.afripay.space/cart

MONEROO_API_KEY=
MONEROO_SECRET_KEY=
MONEROO_WEBHOOK_SECRET=
MONEROO_API_BASE_URL=https://api.moneroo.io

FEDAPAY_API_KEY=
FEDAPAY_SECRET_KEY=
FEDAPAY_WEBHOOK_SECRET=
FEDAPAY_ENVIRONMENT=live
FEDAPAY_API_BASE_URL=https://api.fedapay.com/v1
```

## Deploiement Hostinger VPS

### 1. Paquets systeme

Installer au minimum:

- Nginx
- PHP 8.3 FPM
- extensions PHP usuelles: `mbstring`, `xml`, `curl`, `mysql`, `zip`, `bcmath`, `intl`, `fileinfo`
- Composer
- MySQL ou acces a une instance MySQL distante

### 2. Arborescence recommandee

```text
/var/www/afripay/frontend
/var/www/afripay/backend/laravel
```

### 3. Installation backend

```bash
cd /var/www/afripay/backend/laravel
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan view:cache
```

### 4. Permissions

```bash
chown -R www-data:www-data /var/www/afripay/backend/laravel
chmod -R 775 storage bootstrap/cache
```

### 5. Nginx

Utiliser `deploy/nginx/afripay-api.conf` comme base, puis activer le vhost et recharger Nginx.

Points critiques:

- `root` doit pointer vers `public/`
- `server_name` doit correspondre au sous-domaine API
- `fastcgi_pass` doit correspondre a la version PHP-FPM installee

### 6. SSL

Configurer TLS sur `api.afripay.space` avant d'activer les cookies securises cross-site avec Sanctum.

### 7. Variables production a verifier

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://api.afripay.space`
- `SESSION_DOMAIN=.afripay.space`
- `SESSION_SECURE_COOKIE=true`
- `SESSION_SAME_SITE=none`
- `SANCTUM_STATEFUL_DOMAINS=www.afripay.space,afripay.space`
- credentials Moneroo ou FedaPay
- credentials MySQL reelles

## Verification minimale apres deploiement

```bash
php artisan migrate:status
php artisan route:list
curl -I https://api.afripay.space/
curl https://api.afripay.space/api/test/ping
```

## Journalisation paiements

Un canal de log dedie `payment` est configure dans `config/logging.php`. Il sert a tracer:

- initialisation des paiements
- verification serveur
- reception de webhook
- payloads providers utiles au diagnostic

## Etat du chantier

Le socle Laravel est maintenant proprement structure pour remplacer les endpoints Next.js les plus critiques. La migration totale n'est pas terminee tant que tous les domaines secondaires du backend historique n'ont pas ete portes et testes contre le frontend reel.
