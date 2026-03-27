# Laravel API Backend

Ce dossier contient la cible backend extraite du frontend Next.js.

## Stack

- Laravel 11+
- API only
- PostgreSQL (Vercel Postgres)
- Moneroo pour le paiement
- Déploiement Render

## Endpoints principaux

- `GET /api/products`
- `GET /api/products/{product}`
- `GET /api/products/search?q=...`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/{order}`
- `POST /api/payments/init`
- `POST /api/payments/verify`
- `POST /api/payments/webhook`

## Variables d'environnement

Voir [`.env.example`](/home/kernelx/aliBUY/backend/laravel/.env.example).
