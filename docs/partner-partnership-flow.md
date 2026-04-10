# Partner Partnership Flow

## Objectif

Le programme partenaire AfriPay repose maintenant sur une règle simple: aucun compte ne peut accéder à `/dashboard` tant qu'une demande partenaire n'a pas été approuvée manuellement.

## Parcours complet

1. L'utilisateur crée un compte standard AfriPay ou se connecte.
2. Il ouvre la page publique `/partnership` depuis l'accueil (`Devenir Vendeur`) ou depuis le footer (`Partnership`).
3. Il soumet une demande liée à son e-mail de compte avec:
   - nom d'entreprise
   - site web facultatif
   - description détaillée de l'activité
4. La demande est enregistrée côté backend dans `api_partner_requests` avec le statut `pending`.
5. Un administrateur traite ensuite la demande depuis l'admin via:
   - `GET /api/admin/partner-requests`
   - `POST /api/admin/partner-requests/{id}/approve`
   - `POST /api/admin/partner-requests/{id}/reject`
6. En cas d'approbation:
   - une entrée `api_partners` est créée
   - un wallet dédié est créé
   - le compte approuvé devient éligible à `/dashboard`
   - les données dashboard sont cloisonnées par e-mail partenaire
7. En cas de refus:
   - le compte reste bloqué hors dashboard
   - l'utilisateur peut soumettre une nouvelle demande depuis `/partnership`

## Sécurité d'accès

### Dashboard invisible avant approbation

- Les routes `/dashboard` et `/api/dashboard/*` sont bloquées si aucun utilisateur n'est connecté.
- Le middleware frontend renvoie `404` sur ces routes pour les visiteurs non authentifiés.
- Le layout App Router de `/dashboard` vérifie ensuite que le compte connecté est réellement approuvé. Sans approbation, il renvoie aussi `404`.
- La route admin reste traitée avec le même principe de non-exposition.
- `robots.txt` disallow maintenant:
  - `/admin`
  - `/dashboard`
  - `/home_jacen`

### Portail partenaire signé entre frontend et backend

Le frontend ne lit pas la base directement. Il passe par un portail backend signé:

- Header `X-Partner-Portal-Email`
- Header `X-Partner-Portal-Timestamp`
- Header `X-Partner-Portal-Signature`

La signature est un HMAC SHA-256 basé sur:

- `email.timestamp`
- secret partagé `PARTNER_PORTAL_SHARED_SECRET`

Le backend refuse:

- les headers manquants
- les signatures invalides
- les signatures expirées
- les comptes non approuvés pour les endpoints dashboard

## Architecture des routes

### Frontend local routes

- `POST /api/partner/request`
  - exige une session utilisateur locale
  - force l'e-mail de la demande à l'e-mail du compte connecté
  - empêche de renvoyer une demande si le compte est déjà `pending` ou `approved`
- `GET /api/partner/access`
  - retourne l'état du compte partenaire courant (`guest`, `none`, `pending`, `approved`, `rejected`)
- `GET /api/dashboard/stats`
- `GET /api/dashboard/orders`
- `GET /api/dashboard/wallet`
- `GET /api/dashboard/keys`
  - ces quatre routes exigent un compte approuvé
  - elles proxifient les données du portail backend signé

### Backend portal routes

- `GET /api/partner/portal/access`
- `GET /api/partner/portal/stats`
- `GET /api/partner/portal/orders`
- `GET /api/partner/portal/wallet`
- `GET /api/partner/portal/keys`

Ces endpoints déterminent le partenaire à partir de l'e-mail signé et ne renvoient que les données du compte correspondant.

## Cloisonnement par compte

Le dashboard vendeur n'est plus global.

- `companyName` vient du partenaire approuvé pour cet e-mail
- les stats viennent des `partner_orders` et `partner_transactions` du partenaire concerné
- le wallet vient de `partner_wallets`
- les clés API visibles dans le dashboard sont celles du partenaire lié au compte

Chaque compte approuvé obtient donc:

- son propre dashboard
- ses propres commandes
- son propre wallet
- ses propres clés API
- son propre webhook URL

## Variables d'environnement requises

Le portail partenaire nécessite la même valeur de secret des deux côtés:

- frontend: `PARTNER_PORTAL_SHARED_SECRET`
- backend: `PARTNER_PORTAL_SHARED_SECRET`

Sans cette variable:

- la page `/partnership` peut toujours s'afficher
- mais l'accès à l'état partenaire et au dashboard ne sera pas fiable
- le backend refusera les appels signés du portail

## Notes produit

- La page dédiée partenaire est `/partnership`.
- L'accueil envoie maintenant vers cette page avec le CTA `Devenir Vendeur`.
- Le footer expose aussi `Partnership`.
- Une approbation admin est nécessaire avant toute ouverture de `/dashboard`.
- Le fait d'être connecté ne suffit jamais à ouvrir le dashboard partenaire.