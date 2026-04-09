#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$BACKEND_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

composer install --no-dev --optimize-autoloader

php artisan key:generate --force
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache

if php artisan about >/dev/null 2>&1; then
  php artisan about
fi