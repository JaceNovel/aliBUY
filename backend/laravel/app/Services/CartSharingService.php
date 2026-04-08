<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class CartSharingService
{
    public function countValidItems(array $items): int
    {
        return count($this->normalizeItems($items));
    }

    public function upsertAbandonedCartRecord(User $user, array $payload): array
    {
        $records = $this->readJsonFile($this->abandonedCartsRuntimePath(), $this->abandonedCartsSeedPath(), []);
        $now = now()->toIso8601String();
        $normalizedItems = $this->normalizeItems($payload['items'] ?? []);
        $itemCount = array_sum(array_map(fn (array $item) => (int) $item['quantity'], $normalizedItems));
        $cartHash = json_encode($normalizedItems);
        $settings = is_array($user->settings) ? $user->settings : [];
        $existing = collect($records)->firstWhere('userId', (string) $user->id);

        $record = [
            'id' => $existing['id'] ?? (string) Str::uuid(),
            'userId' => (string) $user->id,
            'userEmail' => (string) $user->email,
            'userDisplayName' => (string) $user->name,
            'connectedWhatsapp' => $this->normalizeOptionalString($settings['connectedWhatsapp'] ?? null),
            'manychatSubscriberId' => $this->normalizeOptionalString($settings['manychatSubscriberId'] ?? null),
            'manychatFlowId' => $this->normalizeOptionalString($settings['manychatFlowId'] ?? null),
            'manychatPaidTagId' => $this->normalizeOptionalString($settings['manychatPaidTagId'] ?? null),
            'items' => $normalizedItems,
            'itemCount' => $itemCount,
            'cartHash' => $cartHash,
            'status' => $itemCount > 0 ? 'active' : 'cleared',
            'createdAt' => $existing['createdAt'] ?? $now,
            'updatedAt' => $now,
            'lastActivityAt' => $now,
            'reminderSentAt' => null,
            'lastReminderResponse' => null,
            'shareToken' => $existing['shareToken'] ?? null,
        ];

        $nextRecords = $existing
            ? array_map(fn (array $entry) => ($entry['userId'] ?? null) === (string) $user->id ? $record : $entry, $records)
            : [...$records, $record];

        $this->writeJsonFile($this->abandonedCartsRuntimePath(), array_values($nextRecords));

        return $record;
    }

    public function clearAbandonedCartRecord(User $user, string $status = 'cleared'): ?array
    {
        $records = $this->readJsonFile($this->abandonedCartsRuntimePath(), $this->abandonedCartsSeedPath(), []);
        $updated = null;

        $nextRecords = array_map(function (array $entry) use ($user, $status, &$updated) {
            if (($entry['userId'] ?? null) !== (string) $user->id) {
                return $entry;
            }

            $updated = [
                ...$entry,
                'status' => $status,
                'items' => [],
                'itemCount' => 0,
                'updatedAt' => now()->toIso8601String(),
            ];

            return $updated;
        }, $records);

        $this->writeJsonFile($this->abandonedCartsRuntimePath(), array_values($nextRecords));

        return $updated;
    }

    public function createSharedCart(User $user, array $items, ?string $message): array
    {
        $sharedCarts = $this->readJsonFile($this->sharedCartsRuntimePath(), $this->sharedCartsSeedPath(), []);
        $timestamp = now()->toIso8601String();
        $sharedCart = [
            'id' => (string) Str::uuid(),
            'token' => bin2hex(random_bytes(16)),
            'ownerUserId' => (string) $user->id,
            'ownerEmail' => (string) $user->email,
            'ownerDisplayName' => (string) $user->name,
            'message' => $this->sanitizeMessage($message),
            'items' => $this->normalizeItems($items),
            'status' => 'active',
            'createdAt' => $timestamp,
            'updatedAt' => $timestamp,
            'expiresAt' => now()->addDays(7)->toIso8601String(),
            'claimCount' => 0,
        ];

        $this->writeJsonFile($this->sharedCartsRuntimePath(), [$sharedCart, ...$sharedCarts]);

        return $sharedCart;
    }

    public function getSharedCartByToken(string $token): ?array
    {
        if (trim($token) === '') {
            return null;
        }

        $sharedCarts = $this->readJsonFile($this->sharedCartsRuntimePath(), $this->sharedCartsSeedPath(), []);
        $match = collect($sharedCarts)->first(fn (array $sharedCart) => ($sharedCart['token'] ?? null) === trim($token));

        return is_array($match) ? $match : null;
    }

    public function markSharedCartClaimed(string $token, string $claimerUserId, string $claimerDisplayName): ?array
    {
        $sharedCarts = $this->readJsonFile($this->sharedCartsRuntimePath(), $this->sharedCartsSeedPath(), []);
        $updated = null;

        $nextSharedCarts = array_map(function (array $entry) use ($token, $claimerUserId, $claimerDisplayName, &$updated) {
            if (($entry['token'] ?? null) !== trim($token)) {
                return $entry;
            }

            $updated = [
                ...$entry,
                'status' => ($entry['status'] ?? null) === 'ordered' ? 'ordered' : 'claimed',
                'claimCount' => ((int) ($entry['claimCount'] ?? 0)) + 1,
                'lastClaimedAt' => now()->toIso8601String(),
                'claimedByUserId' => $claimerUserId,
                'claimedByDisplayName' => $claimerDisplayName,
                'updatedAt' => now()->toIso8601String(),
            ];

            return $updated;
        }, $sharedCarts);

        $this->writeJsonFile($this->sharedCartsRuntimePath(), array_values($nextSharedCarts));

        return $updated;
    }

    public function resolveOrigin(Request $request): string
    {
        $forwardedHost = $request->header('x-forwarded-host');
        $forwardedProto = $request->header('x-forwarded-proto', 'https');

        if (is_string($forwardedHost) && $forwardedHost !== '') {
            return $forwardedProto.'://'.$forwardedHost;
        }

        return $request->getSchemeAndHttpHost();
    }

    protected function normalizeItems(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        return array_values(array_filter(array_map(function ($entry) {
            if (! is_array($entry)) {
                return null;
            }

            $slug = $this->normalizeOptionalString($entry['slug'] ?? null);
            $quantity = (int) ($entry['quantity'] ?? 0);
            if (! $slug || $quantity <= 0) {
                return null;
            }

            $selectedVariants = null;
            if (isset($entry['selectedVariants']) && is_array($entry['selectedVariants'])) {
                $selectedVariants = array_filter($entry['selectedVariants'], fn ($value, $key) => is_string($key) && is_string($value) && trim($value) !== '', ARRAY_FILTER_USE_BOTH);
                if ($selectedVariants === []) {
                    $selectedVariants = null;
                }
            }

            return [
                'slug' => $slug,
                'quantity' => $quantity,
                'selectedVariants' => $selectedVariants,
            ];
        }, $items)));
    }

    protected function sanitizeMessage(?string $message): ?string
    {
        if (! is_string($message)) {
            return null;
        }

        $compact = preg_replace('/\s+/', ' ', trim($message));

        return $compact ? Str::limit($compact, 90, '') : null;
    }

    protected function normalizeOptionalString(mixed $value): ?string
    {
        $normalized = is_string($value) ? trim($value) : '';

        return $normalized !== '' ? $normalized : null;
    }

    protected function abandonedCartsRuntimePath(): string
    {
        return storage_path('app/private/customer/abandoned-carts.json');
    }

    protected function abandonedCartsSeedPath(): string
    {
        return base_path('data/customer/abandoned-carts.json');
    }

    protected function sharedCartsRuntimePath(): string
    {
        return storage_path('app/private/site/shared-carts.json');
    }

    protected function sharedCartsSeedPath(): string
    {
        return base_path('data/site/shared-carts.json');
    }

    protected function readJsonFile(string $runtimePath, string $seedPath, array $fallback): array
    {
        foreach ([$runtimePath, $seedPath] as $path) {
            if (File::exists($path)) {
                $decoded = json_decode((string) File::get($path), true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }

        return $fallback;
    }

    protected function writeJsonFile(string $runtimePath, array $value): void
    {
        File::ensureDirectoryExists(dirname($runtimePath));
        File::put($runtimePath, json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n");
    }
}