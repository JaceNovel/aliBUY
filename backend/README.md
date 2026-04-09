# aliBUY Backend Laravel

Ce dossier est le backend Laravel complet du projet aliBUY. Il expose une API REST JSON uniquement, sans Blade, et il est concu pour fonctionner separement du frontend Next.js present dans `../frontend`.

## Objectif

- fournir un vrai projet Laravel installable avec Composer
- exposer une API REST claire et maintenable
- conserver les contrats frontend critiques pendant la migration depuis les anciennes routes Next.js
- rester deployable sur VPS avec Nginx et `public/` comme document root

## Stack

- Laravel 13
- PHP 8.3
- Laravel Sanctum pour l'auth API
- SQLite par defaut en local via `.env.example`
- MySQL recommande en production
- Moneroo comme provider de paiement principal
- FedaPay prepare comme extension future

## Surface API principale

### Sante

- `GET /api/test/ping`
- `GET /api/health`

### Authentification

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Produits et catalogue

- `GET /api/products`
- `GET /api/products/{product}`
- `POST /api/products`
- `PUT /api/products/{product}`
- `DELETE /api/products/{product}`
- `GET /api/products/featured`
- `GET /api/products/search?q=...`
- `GET /api/products/category`
- `GET /api/products/categories`
- `GET /api/products/categories/{slug}`
- `GET /api/products/{product}/related`
- `POST /api/products/{product}/view`
- `GET /api/catalog/products`
- `GET /api/catalog/categories`

### Commandes

- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/{order}`
- `POST /api/orders/{order}/promo`

### Paiements

- `POST /api/payment/init`
- `POST /api/payment/webhook`
- `POST /api/payments/init`
- `POST /api/payments/verify`
- `POST /api/payments/webhook`
- `POST /api/payments/moneroo/initialize`
- `POST /api/payments/moneroo/verify`
- `POST /api/payments/moneroo/webhook`

### Compte client

- `GET /api/users`
- `GET /api/users/me`
- `GET /api/account/session`
- `GET /api/account/settings`
- `PATCH /api/account/settings`
- `POST /api/account/change-email`
- `POST /api/account/change-password`
- `POST /api/account/delete`
- `POST /api/account/profile-photo`
- `GET /api/account/addresses`
- `POST /api/account/addresses`
- `PUT /api/account/addresses/{address}`
- `PATCH /api/account/addresses/{address}`
- `DELETE /api/account/addresses/{address}`

## Structure applicative

- `app/Http/Controllers`: endpoints REST
- `app/Services`: logique metier et integrations externes
- `app/Models`: modeles Eloquent
- `database/migrations`: schema relationnel versionne
- `database/database.sqlite`: base locale simple pour `php artisan migrate`
- `config/cors.php`: CORS frontend
- `config/sanctum.php`: auth API et cookies stateful
- `deploy/nginx/afripay-api.conf`: base Nginx pour VPS

## Installation locale

```bash
cd backend
composer install
cp .env.example .env
touch database/database.sqlite
php artisan key:generate
php artisan migrate
php artisan serve
```

## Variables d'environnement

Le fichier `.env.example` est pret pour un demarrage local avec SQLite.

```env
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

SESSION_DOMAIN=localhost
SESSION_SECURE_COOKIE=false
SESSION_SAME_SITE=lax
SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000
FRONTEND_URL=http://127.0.0.1:3000
FRONTEND_URLS=http://127.0.0.1:3000,http://localhost:3000

PAYMENT_RETURN_URL=http://127.0.0.1:3000/orders
PAYMENT_CANCEL_URL=http://127.0.0.1:3000/cart
```

Pour la production VPS, remplacer au minimum par des valeurs MySQL et domaine reel:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.alibuy.example

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=alibuy
DB_USERNAME=alibuy
DB_PASSWORD=

SESSION_DOMAIN=.alibuy.example
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=none
SANCTUM_STATEFUL_DOMAINS=www.alibuy.example,alibuy.example
FRONTEND_URL=https://www.alibuy.example
FRONTEND_URLS=https://www.alibuy.example,https://alibuy.example
```

## Relations de donnees

Le schema inclut maintenant:

- `products`
- `orders`
- `order_items`

`order_items` relie proprement les commandes aux produits, tout en conservant un snapshot JSON dans `orders.items` pour compatibilite avec le frontend existant.

## Deploiement VPS Nginx

Arborescence recommandee:

```text
/var/www/alibuy/frontend
/var/www/alibuy/backend
```

Installation backend:

```bash
cd /var/www/alibuy/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan event:cache
```

Permissions:

```bash
chown -R www-data:www-data /var/www/alibuy/backend
chmod -R 775 storage bootstrap/cache
```

Points Nginx critiques:

- `root` doit pointer vers `backend/public`
- le frontend Next.js doit tourner separement
- `/api` peut pointer vers le backend directement par sous-domaine API, ou via reverse proxy frontal si necessaire

## Deploiement Hostinger

Pour Hostinger, deployer le projet depuis le sous-dossier `backend` comme application PHP/Laravel classique, pas comme projet Docker a la racine du monorepo.

Voir [docs/hostinger-deploy.md](docs/hostinger-deploy.md).

## Verification minimale

```bash
php artisan migrate:status
php artisan route:list
curl -I http://127.0.0.1:8000/
curl http://127.0.0.1:8000/api/test/ping
```

## Etat du projet

Le backend est maintenant un vrai projet Laravel autonome. Les endpoints critiques du frontend public sont deja migres, et la poursuite de migration des domaines admin ou secondaires peut se faire sans remettre en cause la structure `backend Laravel` / `frontend Next.js`.
