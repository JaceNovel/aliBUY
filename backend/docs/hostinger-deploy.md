# Deploiement Hostinger du Backend Laravel

Ce backend doit etre deploye depuis le sous-dossier `backend/`, pas depuis la racine du monorepo.

## Point cle

- Ne pas utiliser le mode Docker Compose si Hostinger scanne la racine du repo.
- Le projet backend est un projet PHP/Laravel classique base sur [backend/composer.json](../composer.json).
- Le document root doit pointer vers `backend/public`.

## Parametres recommandes Hostinger

- Repository root: `backend`
- Runtime: PHP 8.3
- Install command: `composer install --no-dev --optimize-autoloader`
- Post-deploy command: `bash deploy/hostinger/post-deploy.sh`
- Web root / document root: `public`

Si Hostinger ne permet pas de changer le repository root et clone la racine complete du monorepo, alors le document root doit etre configure vers `backend/public` et les commandes doivent etre executees depuis `backend`.

## Variables d'environnement minimales

Exemple de base pour Hostinger avec MySQL et frontend Vercel:

```env
APP_NAME=AfriPayBackend
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.afripay.space

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

CACHE_STORE=file
QUEUE_CONNECTION=database
SESSION_DRIVER=file
SESSION_LIFETIME=120
SESSION_DOMAIN=.afripay.space
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=none

SANCTUM_STATEFUL_DOMAINS=afripay.space,www.afripay.space
FRONTEND_URL=https://www.afripay.space
FRONTEND_URLS=https://www.afripay.space,https://afripay.space

ADMIN_EMAIL=
ADMIN_API_TOKEN=

MAIL_MAILER=smtp
MAIL_SCHEME=tls
MAIL_HOST=smtp.titan.email
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=no-reply@afripay.space
MAIL_FROM_NAME=AfriPayBackend
MAIL_EHLO_DOMAIN=afripay.space

MONEROO_API_KEY=
MONEROO_SECRET_KEY=
MONEROO_WEBHOOK_SECRET=
MONEROO_API_BASE_URL=https://api.moneroo.io

ALIEXPRESS_BASE_URL=https://api-sg.aliexpress.com
ALIEXPRESS_APP_KEY=
ALIEXPRESS_APP_SECRET=
ALIEXPRESS_TIMEOUT=20
ALIEXPRESS_DS_LOCALE=fr_FR
ALIEXPRESS_DS_SHIP_TO_COUNTRY=FR
ALIEXPRESS_DS_DEFAULT_LOGISTICS=AliExpress Selection Standard

PAYMENT_PROVIDER=moneroo
PAYMENT_RETURN_URL=https://www.afripay.space/orders
PAYMENT_CANCEL_URL=https://www.afripay.space/cart
```

## Sequence de deploiement manuelle

Depuis le dossier `backend`:

```bash
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate --force
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
```

## Checks apres deploiement

```bash
php artisan route:list
php artisan migrate:status
curl https://api.afripay.space/api/test/ping
curl https://api.afripay.space/api/products
```

## Variables admin AliExpress a ne pas oublier

Les pages admin AliExpress du frontend utilisent un appel serveur-vers-serveur vers `https://api.afripay.space`.
Pour que ces appels passent les routes Laravel protegees par `auth:sanctum`, le backend doit avoir:

- `ADMIN_EMAIL`: l'e-mail du compte admin de reference dans la base Laravel
- `ADMIN_API_TOKEN`: un secret partage entre frontend et backend pour l'acces admin serveur-vers-serveur

Si une de ces variables manque, le frontend peut ouvrir `/admin`, mais les tableaux AliExpress renverront encore `401 Unauthenticated`.

## Si Hostinger affiche "No Docker compose files found"

Ce message signifie seulement que le detecteur automatique cherche un projet Docker a la racine. Ce repo n'en est pas un. Il faut:

- soit deployer le sous-dossier `backend` comme application PHP
- soit pointer explicitement les commandes de build sur `backend`
- soit desactiver le mode Docker si Hostinger propose un mode PHP/Laravel natif

## Si les routes Sanctum proteges retournent 500

Executer apres le deploiement:

```bash
php artisan optimize:clear
php artisan config:clear
php artisan route:clear
php artisan cache:clear
```

Puis verifier une route publique et une route protegee avec token.