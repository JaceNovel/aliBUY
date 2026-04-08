<?php

namespace App\Services;

use Illuminate\Support\Facades\File;

class PromoCodeService
{
    protected array $defaultPromoCodes = [
        [
            'id' => 'promo-welcome-10',
            'code' => 'WELCOME10',
            'label' => 'Bienvenue AfriPay',
            'description' => '10% sur une commande eligible.',
            'amountType' => 'percent',
            'amountValue' => 10,
            'minOrderFcfa' => 25000,
            'maxDiscountFcfa' => 15000,
            'active' => true,
            'startsAt' => '2026-01-01T00:00:00.000Z',
            'endsAt' => '2026-12-31T23:59:59.000Z',
            'usageLimit' => 500,
            'usageCount' => 0,
            'usedOrderIds' => [],
            'createdAt' => '2026-03-25T00:00:00.000Z',
            'updatedAt' => '2026-03-25T00:00:00.000Z',
        ],
    ];

    public function validateForAmount(string $code, float $totalFcfa): array
    {
        $promoCode = collect($this->getPromoCodes())
            ->first(fn (array $promo) => strtoupper(trim((string) $promo['code'])) === strtoupper(trim($code)));

        if (! $promoCode) {
            throw new \RuntimeException('Code promo introuvable.');
        }

        if (! $this->isActive($promoCode)) {
            throw new \RuntimeException('Ce code promo n\'est pas actif.');
        }

        if ($totalFcfa < (float) $promoCode['minOrderFcfa']) {
            throw new \RuntimeException('Ce code promo est disponible dès '.number_format((float) $promoCode['minOrderFcfa'], 0, ',', ' ').' FCFA.');
        }

        $discountFcfa = $promoCode['amountType'] === 'percent'
            ? round(($totalFcfa * (float) $promoCode['amountValue']) / 100)
            : round((float) $promoCode['amountValue']);

        if (isset($promoCode['maxDiscountFcfa']) && is_numeric($promoCode['maxDiscountFcfa'])) {
            $discountFcfa = min($discountFcfa, (float) $promoCode['maxDiscountFcfa']);
        }

        $discountFcfa = max(0, min($discountFcfa, $totalFcfa));
        if ($discountFcfa <= 0) {
            throw new \RuntimeException('Ce code promo ne génère aucune réduction sur ce panier.');
        }

        return [
            'promoCode' => $promoCode,
            'discountFcfa' => (int) $discountFcfa,
            'finalTotalFcfa' => (int) max(0, $totalFcfa - $discountFcfa),
        ];
    }

    protected function getPromoCodes(): array
    {
        $paths = [
            base_path('data/site/promo-codes.json'),
            dirname(base_path()).'/data/site/promo-codes.json',
        ];

        foreach ($paths as $path) {
            if (File::exists($path)) {
                $decoded = json_decode((string) File::get($path), true);
                if (is_array($decoded) && $decoded !== []) {
                    return $decoded;
                }
            }
        }

        return $this->defaultPromoCodes;
    }

    protected function isActive(array $promoCode): bool
    {
        if (! ($promoCode['active'] ?? false)) {
            return false;
        }

        $now = now();
        if (! empty($promoCode['startsAt']) && $now->lt((string) $promoCode['startsAt'])) {
            return false;
        }

        if (! empty($promoCode['endsAt']) && $now->gt((string) $promoCode['endsAt'])) {
            return false;
        }

        return ! isset($promoCode['usageLimit'])
            || ! is_numeric($promoCode['usageLimit'])
            || (int) ($promoCode['usageCount'] ?? 0) < (int) $promoCode['usageLimit'];
    }
}