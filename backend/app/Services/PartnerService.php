<?php

namespace App\Services;

use App\Mail\PartnerApprovedMail;
use App\Models\ApiPartner;
use App\Models\ApiPartnerRequest;
use App\Models\PartnerTransaction;
use App\Models\PartnerWallet;
use App\Models\PartnerWithdrawal;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class PartnerService
{
    public function submitRequest(array $validated): ApiPartnerRequest
    {
        return ApiPartnerRequest::query()->create([
            'company_name' => $validated['company_name'],
            'website' => $validated['website'] ?? null,
            'email' => strtolower($validated['email']),
            'description' => trim($validated['description']),
            'status' => 'pending',
            'decision_reason' => null,
            'reviewed_at' => null,
        ]);
    }

    public function approveRequest(ApiPartnerRequest $requestModel, ?User $user, ?string $webhookUrl = null): array
    {
        $this->assertAdmin($user);

        if ($requestModel->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Cette demande partner a deja ete traitee.',
            ]);
        }

        $plainTextSecret = bin2hex(random_bytes(32));
        $appKey = $this->generateUniqueAppKey();

        $partner = DB::transaction(function () use ($requestModel, $webhookUrl, $appKey, $plainTextSecret) {
            $partner = ApiPartner::query()->create([
                'company_name' => $requestModel->company_name,
                'email' => strtolower($requestModel->email),
                'app_key' => $appKey,
                'app_secret' => Hash::make($plainTextSecret),
                'plain_text_secret' => $plainTextSecret,
                'webhook_url' => $webhookUrl ?: null,
                'is_active' => true,
            ]);

            PartnerWallet::query()->create([
                'partner_id' => $partner->id,
                'balance' => 0,
            ]);

            $requestModel->forceFill([
                'status' => 'approved',
                'decision_reason' => null,
                'reviewed_at' => now(),
            ])->save();

            return $partner;
        });

        $this->queueApprovalMail($partner, $requestModel);

        return [
            'partner' => $partner->fresh('wallet'),
            'plain_text_secret' => $plainTextSecret,
        ];
    }

    public function regenerateSecret(ApiPartner $partner): string
    {
        $plainTextSecret = bin2hex(random_bytes(32));

        $partner->forceFill([
            'app_secret' => Hash::make($plainTextSecret),
            'plain_text_secret' => $plainTextSecret,
        ])->save();

        return $plainTextSecret;
    }

    public function rejectRequest(ApiPartnerRequest $requestModel, ?User $user, ?string $reason = null): ApiPartnerRequest
    {
        $this->assertAdmin($user);

        if ($requestModel->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Cette demande partner a deja ete traitee.',
            ]);
        }

        $requestModel->forceFill([
            'status' => 'rejected',
            'decision_reason' => $this->normalizeDecisionReason($reason, 'Dossier non coherent.'),
            'reviewed_at' => now(),
        ])->save();

        return $requestModel;
    }

    public function blockPartnerRequest(ApiPartnerRequest $requestModel, ?User $user, ?string $reason = null): ApiPartner
    {
        $this->assertAdmin($user);

        if ($requestModel->status !== 'approved') {
            throw ValidationException::withMessages([
                'status' => 'Seules les demandes approuvees peuvent etre bloquees.',
            ]);
        }

        $partner = ApiPartner::query()
            ->where('email', strtolower($requestModel->email))
            ->latest()
            ->first();

        if (! $partner) {
            throw ValidationException::withMessages([
                'partner' => 'Compte partenaire introuvable pour cette demande approuvee.',
            ]);
        }

        $normalizedReason = $this->normalizeDecisionReason($reason, 'Compte partenaire bloque apres verification d activite suspecte.');

        $partner->forceFill([
            'is_active' => false,
            'deactivated_reason' => $normalizedReason,
            'deactivated_at' => now(),
        ])->save();

        $requestModel->forceFill([
            'status' => 'blocked',
            'decision_reason' => $normalizedReason,
            'reviewed_at' => now(),
        ])->save();

        return $partner->fresh('wallet');
    }

    public function reactivatePartnerRequest(ApiPartnerRequest $requestModel, ?User $user): ApiPartner
    {
        $this->assertAdmin($user);

        $partner = ApiPartner::query()
            ->where('email', strtolower($requestModel->email))
            ->latest()
            ->first();

        if (! $partner) {
            throw ValidationException::withMessages([
                'partner' => 'Compte partenaire introuvable pour cette demande.',
            ]);
        }

        $partner->forceFill([
            'is_active' => true,
            'deactivated_reason' => null,
            'deactivated_at' => null,
        ])->save();

        $requestModel->forceFill([
            'status' => 'approved',
            'decision_reason' => null,
            'reviewed_at' => now(),
        ])->save();

        return $partner->fresh('wallet');
    }

    public function authenticateRequest(Request $request): ApiPartner
    {
        $appKey = trim((string) $request->header('X-APP-KEY', ''));
        $appSecret = trim((string) $request->header('X-APP-SECRET', ''));

        if ($appKey === '' || $appSecret === '') {
            throw new AuthorizationException('Headers X-APP-KEY et X-APP-SECRET obligatoires.');
        }

        $partner = ApiPartner::query()->where('app_key', $appKey)->first();

        if (! $partner || ! Hash::check($appSecret, $partner->app_secret)) {
            throw new AuthorizationException('Identifiants partner invalides.');
        }

        if (! $partner->is_active) {
            throw new AuthorizationException('Ce partner API est desactive.');
        }

        $this->assertAllowedIp($request);
        $this->assertOptionalSignature($request, $appSecret);

        return $partner;
    }

    public function assertAdmin(?User $user): void
    {
        if (! $user || ! $user->hasAdminAccess()) {
            throw new AuthorizationException('Acces admin requis.');
        }
    }

    public function transformRequest(ApiPartnerRequest $requestModel): array
    {
        $partner = ApiPartner::query()
            ->with('wallet')
            ->where('email', strtolower((string) $requestModel->email))
            ->latest()
            ->first();
        $status = $requestModel->status;

        if ($partner && ! $partner->is_active && in_array($requestModel->status, ['approved', 'blocked'], true)) {
            $status = 'blocked';
        }

        return [
            'id' => (string) $requestModel->id,
            'company_name' => $requestModel->company_name,
            'website' => $requestModel->website,
            'email' => $requestModel->email,
            'description' => $requestModel->description,
            'status' => $status,
            'decision_reason' => $requestModel->decision_reason,
            'reviewed_at' => optional($requestModel->reviewed_at)->toIso8601String(),
            'partner' => $partner ? $this->transformPartner($partner) : null,
            'created_at' => optional($requestModel->created_at)->toIso8601String(),
        ];
    }

    public function transformPartner(ApiPartner $partner): array
    {
        return [
            'id' => (string) $partner->id,
            'company_name' => $partner->company_name,
            'email' => $partner->email,
            'app_key' => $partner->app_key,
            'webhook_url' => $partner->webhook_url,
            'is_active' => (bool) $partner->is_active,
            'deactivated_reason' => $partner->deactivated_reason,
            'deactivated_at' => optional($partner->deactivated_at)->toIso8601String(),
            'created_at' => optional($partner->created_at)->toIso8601String(),
            'wallet_balance' => $partner->wallet ? (float) $partner->wallet->balance : 0.0,
        ];
    }

    protected function normalizeDecisionReason(?string $reason, string $fallback): string
    {
        $normalized = trim((string) $reason);

        return $normalized !== '' ? $normalized : $fallback;
    }

    public function transformWithdrawal(PartnerWithdrawal $withdrawal): array
    {
        $estimatedProcessingDelayHours = $withdrawal->method === 'bank_transfer' ? 72 : 24;

        return [
            'id' => (string) $withdrawal->id,
            'partnerId' => (string) $withdrawal->partner_id,
            'amount' => (float) $withdrawal->amount,
            'method' => $withdrawal->method,
            'status' => $withdrawal->status,
            'bankAccountName' => $withdrawal->bank_account_name,
            'bankName' => $withdrawal->bank_name,
            'iban' => $withdrawal->iban,
            'swiftCode' => $withdrawal->swift_code,
            'mobileMoneyNumber' => $withdrawal->mobile_money_number,
            'mobileMoneyCountryCode' => $withdrawal->mobile_money_country_code,
            'mobileMoneyOperator' => $withdrawal->mobile_money_operator,
            'adminNote' => $withdrawal->admin_note,
            'processedAt' => optional($withdrawal->processed_at)->toIso8601String(),
            'createdAt' => optional($withdrawal->created_at)->toIso8601String(),
            'estimatedProcessingDelayHours' => $estimatedProcessingDelayHours,
        ];
    }

    public function createWithdrawal(ApiPartner $partner, array $validated): PartnerWithdrawal
    {
        $wallet = $partner->wallet;
        if (! $wallet) {
          throw ValidationException::withMessages([
              'wallet' => 'Wallet partenaire introuvable.',
          ]);
        }

        $recentRequestExists = PartnerWithdrawal::query()
            ->where('partner_id', $partner->id)
            ->where('created_at', '>=', Carbon::now()->subDays(7))
            ->exists();

        if ($recentRequestExists) {
            throw ValidationException::withMessages([
                'amount' => 'Un retrait ne peut etre demande qu une seule fois par semaine.',
            ]);
        }

        $amount = (float) ($validated['amount'] ?? 0);
        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'Le montant du retrait doit etre superieur a zero.',
            ]);
        }

        if ($amount > (float) $wallet->balance) {
            throw ValidationException::withMessages([
                'amount' => 'Le montant du retrait depasse le solde actif du partenaire.',
            ]);
        }

        return PartnerWithdrawal::query()->create([
            'partner_id' => $partner->id,
            'amount' => $amount,
            'method' => $validated['method'],
            'status' => 'pending',
            'bank_account_name' => $validated['bank_account_name'] ?? null,
            'bank_name' => $validated['bank_name'] ?? null,
            'iban' => $validated['iban'] ?? null,
            'swift_code' => $validated['swift_code'] ?? null,
            'mobile_money_number' => $validated['mobile_money_number'] ?? null,
            'mobile_money_country_code' => $validated['mobile_money_country_code'] ?? null,
            'mobile_money_operator' => $validated['mobile_money_operator'] ?? null,
        ]);
    }

    public function approveWithdrawal(PartnerWithdrawal $withdrawal, ?User $user, ?string $adminNote = null): PartnerWithdrawal
    {
        $this->assertAdmin($user);

        if ($withdrawal->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Ce retrait a deja ete traite.',
            ]);
        }

        $partner = $withdrawal->partner()->with('wallet')->firstOrFail();
        $wallet = $partner->wallet;
        if (! $wallet || (float) $wallet->balance < (float) $withdrawal->amount) {
            throw ValidationException::withMessages([
                'amount' => 'Le solde partenaire est insuffisant pour approuver ce retrait.',
            ]);
        }

        DB::transaction(function () use ($withdrawal, $wallet, $adminNote) {
            $wallet->forceFill([
                'balance' => (float) $wallet->balance - (float) $withdrawal->amount,
            ])->save();

            PartnerTransaction::query()->create([
                'partner_id' => $withdrawal->partner_id,
                'amount' => (float) $withdrawal->amount,
                'type' => 'debit',
                'description' => sprintf('Retrait approuve via %s', $withdrawal->method === 'bank_transfer' ? 'virement bancaire' : 'mobile money'),
            ]);

            $withdrawal->forceFill([
                'status' => 'approved',
                'admin_note' => $adminNote,
                'processed_at' => now(),
            ])->save();
        });

        return $withdrawal->fresh();
    }

    public function rejectWithdrawal(PartnerWithdrawal $withdrawal, ?User $user, ?string $adminNote = null): PartnerWithdrawal
    {
        $this->assertAdmin($user);

        if ($withdrawal->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Ce retrait a deja ete traite.',
            ]);
        }

        $withdrawal->forceFill([
            'status' => 'rejected',
            'admin_note' => $adminNote,
            'processed_at' => now(),
        ])->save();

        return $withdrawal;
    }

    protected function queueApprovalMail(ApiPartner $partner, ApiPartnerRequest $requestModel): void
    {
        try {
            Mail::to($partner->email)->queue(
                (new PartnerApprovedMail($partner, $requestModel))->afterCommit()
            );

            Log::info('Partner approval email queued.', [
                'partner_id' => $partner->id,
                'partner_email' => $partner->email,
                'company_name' => $partner->company_name,
            ]);
        } catch (\Throwable $exception) {
            Log::error('Failed to queue partner approval email.', [
                'partner_id' => $partner->id,
                'partner_email' => $partner->email,
                'company_name' => $partner->company_name,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public function docs(): array
    {
        return [
            'title' => 'AfriPay API Documentation',
            'style' => 'stripe-shopify-dev-docs',
            'introduction' => [
                'description' => 'AfriPay est une API permettant aux partenaires de recuperer des produits, vendre sur leur site, encaisser via AfriPay et automatiser commandes et livraison.',
                'goal' => 'Permettre a un developpeur d integrer AfriPay en moins de 1 heure.',
            ],
            'base_url' => [
                'production' => 'https://api.afripay.space/api',
            ],
            'authentication' => [
                'description' => 'Toutes les requetes doivent etre faites depuis le backend avec des API keys partner valides.',
                'headers' => [
                    'X-APP-KEY' => 'afripay_live_xxx',
                    'X-APP-SECRET' => 'sk_live_xxx',
                    'X-TIMESTAMP' => 'optional unix timestamp for signed requests',
                    'X-SIGNATURE' => 'optional sha256 HMAC of "timestamp.body" using X-APP-SECRET',
                ],
            ],
            'products' => [
                'endpoint' => 'GET /partner/products',
                'description' => 'Retourne le catalogue produits.',
                'example_response' => [[
                    'id' => 1,
                    'name' => 'Casque Gaming',
                    'base_price' => 1000,
                    'stock' => 50,
                    'image' => 'https://cdn.afripay.space/products/casque-gaming.png',
                ]],
            ],
            'orders' => [
                'endpoint' => 'POST /partner/orders',
                'description' => 'Permet de creer une commande partenaire.',
                'body' => [
                    'product_id' => 1,
                    'selling_price' => 1200,
                    'quantity' => 1,
                    'customer' => [
                        'name' => 'Ali',
                        'phone' => '+2250700000000',
                    ],
                ],
                'response' => [
                    'order_id' => 'AFR123',
                    'payment_url' => 'https://checkout.moneroo.io/pay/abc123',
                ],
            ],
            'payments' => [
                'description' => 'Le partenaire redirige le client vers payment_url. AfriPay gere le paiement Moneroo, la validation et le traitement.',
                'redirect' => 'window.location.href = payment_url',
                'statuses' => ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'],
            ],
            'webhooks' => [
                'events' => ['order.created', 'order.paid', 'order.shipped', 'order.delivered'],
                'payload' => [
                    'event' => 'order.paid',
                    'data' => [
                        'order_id' => 'AFR123',
                        'margin' => 200,
                    ],
                ],
            ],
            'wallet' => [
                'description' => 'Le partenaire recoit sa marge automatiquement dans son wallet.',
                'example_balance' => '12 500 CFA',
            ],
            'tracking' => [
                'endpoint' => 'GET /partner/orders/{id}',
                'returns' => ['statut', 'tracking', 'infos client'],
            ],
            'security' => [
                'rules' => [
                    'API keys obligatoires',
                    'signature webhook HMAC',
                    'HTTPS obligatoire',
                ],
            ],
            'errors' => [
                'example' => [
                    'error' => true,
                    'message' => 'Unauthorized',
                ],
            ],
            'best_practices' => [
                'ne jamais exposer APP_SECRET',
                'utiliser le backend',
                'gerer les webhooks',
                'stocker les commandes localement',
            ],
            'global_flow' => [
                'Client',
                'site partenaire',
                'API AfriPay',
                'paiement',
                'webhook',
                'dashboard',
            ],
            'guides' => [
                [
                    'title' => 'Recuperer les produits',
                    'endpoint' => 'GET /api/partner/products',
                    'description' => 'Permet de recuperer la liste des produits disponibles.',
                    'curl' => "curl -X GET https://api.afripay.space/api/partner/products \\\n+-H \"X-APP-KEY: afripay_live_xxx\" \\\n+-H \"X-APP-SECRET: sk_live_xxx\"",
                    'response_example' => [[
                        'id' => 1,
                        'name' => 'Casque Gaming',
                        'base_price' => 1000,
                        'description' => 'Casque haute qualite',
                        'image' => 'https://cdn.afripay.space/products/casque-gaming.png',
                        'stock' => 50,
                    ]],
                ],
                [
                    'title' => 'Importer les produits sur son site',
                    'description' => 'Le partenaire doit enregistrer les produits dans sa propre base de donnees.',
                    'store_fields' => ['product_id (AfriPay)', 'name', 'base_price', 'selling_price', 'image'],
                    'pricing_logic' => 'selling_price = base_price + marge',
                ],
                [
                    'title' => 'Fixer la marge',
                    'description' => 'Le partenaire est libre de definir son prix et peut modifier sa marge a tout moment.',
                    'example' => [
                        'base_price' => 1000,
                        'selling_price' => 1200,
                        'margin' => 200,
                    ],
                ],
                [
                    'title' => 'Mise a jour dynamique des produits',
                    'description' => 'Le partenaire peut mettre a jour ses prix et synchroniser les produits regulierement.',
                    'recommendation' => 'Créer une tache CRON qui appelle GET /api/partner/products toutes les 1h ou 24h.',
                    'best_practices' => [
                        'mettre en cache les produits',
                        'mettre a jour les stocks regulierement',
                        'toujours afficher le prix selling_price, jamais le base_price cote client final',
                    ],
                ],
                [
                    'title' => 'Flux complet',
                    'steps' => [
                        'Recuperer les produits via API',
                        'Stocker dans sa base',
                        'Definir une marge',
                        'Afficher sur son site',
                        'Quand client achete, appeler API commande',
                    ],
                ],
                [
                    'title' => 'Creer une commande partenaire',
                    'endpoint' => 'POST /api/partner/orders',
                    'body' => [
                        'product_id' => 1,
                        'selling_price' => 1200,
                        'quantity' => 1,
                        'customer' => [
                            'name' => 'Ali',
                            'phone' => '+2250700000000',
                        ],
                    ],
                    'logic' => [
                        'recuperer le produit et son base_price',
                        'calculer total_base_price',
                        'calculer margin = (selling_price - base_price) * quantity',
                        'creer la commande interne et le lien partner_order',
                        'initialiser le paiement et retourner payment_url',
                    ],
                    'response_example' => [
                        'order_id' => 'AFR123',
                        'payment_url' => 'https://checkout.moneroo.io/pay/abc123',
                    ],
                ],
                [
                    'title' => 'Suivre les commandes',
                    'endpoints' => [
                        ['method' => 'GET', 'path' => '/api/partner/orders', 'description' => 'Lister les commandes du partenaire'],
                        ['method' => 'GET', 'path' => '/api/partner/orders/{id}', 'description' => 'Voir le detail d une commande et son tracking'],
                    ],
                    'filters' => [
                        'GET /api/partner/orders?status=paid',
                        'Statuts disponibles: pending, paid, processing, shipped, delivered, cancelled',
                    ],
                ],
                [
                    'title' => 'Erreurs',
                    'response_example' => [
                        'error' => true,
                        'message' => 'Unauthorized',
                    ],
                ],
            ],
            'webhooks_guide' => [
                'title' => 'Webhooks AfriPay',
                'introduction' => [
                    'description' => "Un webhook permet a AfriPay d'envoyer automatiquement des evenements vers votre serveur lorsqu'une action se produit (paiement, livraison, etc.).",
                    'benefit' => 'Cela permet de synchroniser votre systeme en temps reel sans avoir a faire des requetes en continu.',
                ],
                'configuration' => [
                    'steps' => [
                        'Connectez-vous a votre dashboard AfriPay',
                        'Allez dans Settings',
                        'Ajoutez votre Webhook URL',
                        'Cliquez sur Save',
                    ],
                    'example_url' => 'https://monsite.com/api/webhook/afripay',
                ],
                'events' => [
                    'order.created',
                    'order.paid',
                    'order.processing',
                    'order.shipped',
                    'order.delivered',
                    'order.cancelled',
                ],
                'payload_format' => [
                    'example' => [
                        'event' => 'order.paid',
                        'data' => [
                            'order_id' => 'AFR123',
                            'status' => 'paid',
                            'margin' => 200,
                            'amount' => 1200,
                        ],
                        'timestamp' => 1710000000,
                    ],
                ],
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-SIGNATURE' => '<signature>',
                ],
                'security' => [
                    'description' => 'La signature est generee avec HMAC_SHA256(payload, APP_SECRET).',
                    'node_example' => <<<'NODE'
const crypto = require("crypto");

const expectedSignature = crypto
  .createHmac("sha256", APP_SECRET)
  .update(JSON.stringify(req.body))
  .digest("hex");

if (expectedSignature !== req.headers["x-signature"]) {
  return res.status(401).send("Invalid signature");
}
NODE,
                ],
                'endpoint_examples' => [
                    'node' => <<<'NODE'
app.post("/api/webhook/afripay", (req, res) => {
  const event = req.body.event;

  if (event === "order.paid") {
    // traiter commande
  }

  res.status(200).send("OK");
});
NODE,
                    'php' => <<<'PHP'
$data = json_decode(file_get_contents("php://input"), true);

if ($data["event"] === "order.paid") {
    // traiter commande
}

http_response_code(200);
PHP,
                ],
                'expected_response' => [
                    'status' => 'HTTP 200 OK',
                    'description' => "Sinon AfriPay considerera que l'evenement a echoue.",
                ],
                'retry_policy' => [
                    'attempts' => 3,
                    'strategy' => 'delai progressif',
                ],
                'testing' => [
                    'dashboard_button' => 'Send Test Webhook',
                    'description' => 'Permet de verifier votre configuration.',
                ],
                'errors' => [
                    'example' => [
                        'error' => true,
                        'message' => 'Invalid signature',
                    ],
                ],
                'best_practices' => [
                    'Ne jamais exposer APP_SECRET cote frontend',
                    'Toujours valider la signature',
                    'Repondre rapidement (moins de 5 secondes)',
                    'Logger les evenements recus',
                    'Gerer les retries (idempotence)',
                ],
                'flow' => [
                    'Client paie',
                    'AfriPay recoit confirmation',
                    'AfriPay envoie webhook',
                    'Votre serveur traite l evenement',
                    'Votre systeme est synchronise',
                ],
                'goal' => 'Permettre a un developpeur d integrer un webhook AfriPay en moins de 10 minutes.',
            ],
            'payments_guide' => [
                'title' => 'Paiement via AfriPay API',
                'style' => 'stripe-api-docs',
                'introduction' => [
                    'description' => "AfriPay permet aux partenaires d'encaisser des paiements automatiquement via leur propre site, tout en utilisant l'infrastructure de paiement AfriPay.",
                    'afripay_handles' => [
                        'la transaction',
                        'la validation',
                        'la livraison',
                        'le calcul de la marge partenaire',
                    ],
                    'important' => 'Le partenaire ne traite jamais le paiement directement.',
                ],
                'global_flow' => [
                    'Le client passe commande sur le site partenaire',
                    'Le backend du partenaire appelle l API AfriPay',
                    'AfriPay cree une commande',
                    'AfriPay genere un lien de paiement',
                    'Le client est redirige vers le paiement',
                    'Le client paie via Moneroo',
                    'AfriPay confirme la commande',
                    'Le partenaire est credite de sa marge',
                ],
                'create_order' => [
                    'endpoint' => 'POST /api/partner/orders',
                    'headers' => [
                        'X-APP-KEY' => 'your_app_key',
                        'X-APP-SECRET' => 'your_app_secret',
                    ],
                    'body' => [
                        'product_id' => 1,
                        'selling_price' => 1200,
                        'quantity' => 1,
                        'customer' => [
                            'name' => 'Ali',
                            'phone' => '+2250700000000',
                        ],
                    ],
                ],
                'api_response' => [
                    'example' => [
                        'order_id' => 'AFR123',
                        'payment_url' => 'https://payment.afripay.space/checkout/abc123',
                    ],
                ],
                'client_redirection' => [
                    'description' => 'Le partenaire doit rediriger le client vers payment_url.',
                    'example' => 'window.location.href = payment_url',
                ],
                'payment_processing' => [
                    'customer_pays_via' => ['Mobile Money', 'Carte bancaire'],
                    'provider' => 'Moneroo (gere par AfriPay)',
                ],
                'payment_confirmation' => [
                    'description' => 'AfriPay recoit une notification webhook Moneroo puis valide la commande.',
                    'steps' => [
                        'met status = paid',
                        'calcule la marge',
                        'credite le partenaire',
                    ],
                ],
                'partner_notification' => [
                    'webhook_example' => [
                        'event' => 'order.paid',
                        'data' => [
                            'order_id' => 'AFR123',
                            'status' => 'paid',
                            'margin' => 200,
                        ],
                    ],
                ],
                'margin' => [
                    'example' => [
                        'base_price' => 1000,
                        'selling_price' => 1200,
                        'margin' => 200,
                    ],
                    'description' => 'Le partenaire recoit la marge dans son wallet.',
                ],
                'statuses' => [
                    'pending' => 'commande creee',
                    'paid' => 'paiement valide',
                    'processing' => 'en cours',
                    'shipped' => 'expedie',
                    'delivered' => 'livre',
                    'cancelled' => 'annule',
                ],
                'errors' => [
                    'example' => [
                        'error' => true,
                        'message' => 'Invalid API key',
                    ],
                ],
                'best_practices' => [
                    'Toujours appeler l API depuis le backend',
                    'Ne jamais exposer APP_SECRET cote frontend',
                    'Toujours utiliser HTTPS',
                    'Gerer les webhooks pour mise a jour des commandes',
                    'Verifier les statuts avant traitement',
                ],
                'security' => [
                    'Auth via API keys',
                    'Signature webhook',
                    'Validation des donnees',
                ],
                'full_flow' => [
                    'Client',
                    'Site partenaire',
                    'AfriPay API',
                    'Paiement Moneroo',
                    'AfriPay backend',
                    'Webhook partenaire',
                    'Dashboard vendeur',
                ],
                'goal' => 'Permettre a un developpeur partenaire de declencher un paiement, rediriger le client, recevoir confirmation et suivre ses revenus.',
            ],
        ];
    }

    protected function generateUniqueAppKey(): string
    {
        do {
            $appKey = 'afripay_live_'.Str::lower(Str::random(32));
        } while (ApiPartner::query()->where('app_key', $appKey)->exists());

        return $appKey;
    }

    protected function assertAllowedIp(Request $request): void
    {
        $allowedIps = config('partners.allowed_ips', []);

        if ($allowedIps === [] || in_array($request->ip(), $allowedIps, true)) {
            return;
        }

        throw new AuthorizationException('Adresse IP non autorisee pour cette API.');
    }

    protected function assertOptionalSignature(Request $request, string $appSecret): void
    {
        $signature = trim((string) $request->header('X-SIGNATURE', ''));
        if ($signature === '') {
            return;
        }

        $timestamp = trim((string) $request->header('X-TIMESTAMP', ''));
        if ($timestamp === '' || ! ctype_digit($timestamp)) {
            throw new AuthorizationException('Header X-TIMESTAMP invalide pour la signature partner.');
        }

        $ttl = max((int) config('partners.signature_ttl', 300), 1);
        if (abs(now()->timestamp - (int) $timestamp) > $ttl) {
            throw new AuthorizationException('Signature partner expiree.');
        }

        $expected = hash_hmac('sha256', $timestamp.'.'.$request->getContent(), $appSecret);
        if (! hash_equals($expected, $signature)) {
            throw new AuthorizationException('Signature HMAC invalide.');
        }
    }
}