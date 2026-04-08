<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class CustomerInteractionService
{
    public function createQuoteRequest(User $user, array $payload): array
    {
        $requests = $this->readJsonFile($this->quoteRequestsRuntimePath(), $this->quoteRequestsSeedPath(), []);
        $timestamp = now()->toIso8601String();

        $request = [
            'id' => (string) Str::uuid(),
            'userId' => (string) $user->id,
            'userEmail' => (string) $user->email,
            'userDisplayName' => (string) $user->name,
            'productName' => trim((string) ($payload['productName'] ?? '')),
            'quantity' => trim((string) ($payload['quantity'] ?? '')),
            'specifications' => trim((string) ($payload['specifications'] ?? '')),
            'budget' => trim((string) ($payload['budget'] ?? '')),
            'shippingWindow' => trim((string) ($payload['shippingWindow'] ?? '')),
            'notes' => $this->normalizeOptionalString($payload['notes'] ?? null),
            'status' => 'En attente',
            'createdAt' => $timestamp,
            'updatedAt' => $timestamp,
        ];

        $this->writeJsonFile($this->quoteRequestsRuntimePath(), array_values([$request, ...$requests]));
        $this->ensureDefaultSupportConversation($user);
        $this->clearAbandonedQuoteRecord($user, 'submitted');

        return $request;
    }

    public function upsertAbandonedQuoteRecord(User $user, array $payload): array
    {
        $records = $this->readJsonFile($this->abandonedQuotesRuntimePath(), $this->abandonedQuotesSeedPath(), []);
        $now = now()->toIso8601String();
        $existing = collect($records)->firstWhere('userId', (string) $user->id);
        $hasMeaningfulDraft = collect([
            $payload['productName'] ?? '',
            $payload['quantity'] ?? '',
            $payload['specifications'] ?? '',
            $payload['notes'] ?? '',
        ])->contains(fn ($value) => is_string($value) && trim($value) !== '');

        $settings = is_array($user->settings) ? $user->settings : [];
        $record = [
            'id' => $existing['id'] ?? (string) Str::uuid(),
            'userId' => (string) $user->id,
            'userEmail' => (string) $user->email,
            'userDisplayName' => (string) $user->name,
            'connectedWhatsapp' => $this->normalizeOptionalString($settings['connectedWhatsapp'] ?? null),
            'manychatSubscriberId' => $this->normalizeOptionalString($settings['manychatSubscriberId'] ?? null),
            'manychatFlowId' => $this->normalizeOptionalString($settings['manychatFlowId'] ?? null),
            'productName' => trim((string) ($payload['productName'] ?? '')),
            'quantity' => trim((string) ($payload['quantity'] ?? '')),
            'specifications' => trim((string) ($payload['specifications'] ?? '')),
            'budget' => trim((string) ($payload['budget'] ?? '')),
            'shippingWindow' => trim((string) ($payload['shippingWindow'] ?? '')),
            'notes' => $this->normalizeOptionalString($payload['notes'] ?? null),
            'status' => $hasMeaningfulDraft ? 'active' : 'cleared',
            'createdAt' => $existing['createdAt'] ?? $now,
            'updatedAt' => $now,
            'lastActivityAt' => $now,
            'reminderSentAt' => null,
            'lastReminderResponse' => null,
        ];

        $nextRecords = $existing
            ? array_map(fn (array $entry) => ($entry['userId'] ?? null) === (string) $user->id ? $record : $entry, $records)
            : [...$records, $record];
        $this->writeJsonFile($this->abandonedQuotesRuntimePath(), array_values($nextRecords));

        return $record;
    }

    public function clearAbandonedQuoteRecord(User $user, string $status = 'cleared'): ?array
    {
        $records = $this->readJsonFile($this->abandonedQuotesRuntimePath(), $this->abandonedQuotesSeedPath(), []);
        $updated = null;
        $nextRecords = array_map(function (array $entry) use ($user, $status, &$updated) {
            if (($entry['userId'] ?? null) !== (string) $user->id) {
                return $entry;
            }

            $updated = [
                ...$entry,
                'status' => $status,
                'productName' => '',
                'quantity' => '',
                'specifications' => '',
                'budget' => '',
                'shippingWindow' => '',
                'notes' => null,
                'updatedAt' => now()->toIso8601String(),
            ];

            return $updated;
        }, $records);

        $this->writeJsonFile($this->abandonedQuotesRuntimePath(), array_values($nextRecords));

        return $updated;
    }

    public function getUserSupportConversations(string $userId): array
    {
        $conversations = $this->readJsonFile($this->supportConversationsRuntimePath(), $this->supportConversationsSeedPath(), []);

        return collect($conversations)
            ->filter(fn (array $conversation) => ($conversation['userId'] ?? null) === $userId)
            ->sortByDesc(fn (array $conversation) => $conversation['updatedAt'] ?? '')
            ->values()
            ->all();
    }

    public function ensureDefaultSupportConversation(User $user): array
    {
        $conversations = $this->readJsonFile($this->supportConversationsRuntimePath(), $this->supportConversationsSeedPath(), []);
        $existing = collect($conversations)->first(fn (array $conversation) => ($conversation['userId'] ?? null) === (string) $user->id && ($conversation['tab'] ?? null) === 'service' && empty($conversation['orderId']));
        if ($existing) {
            return $existing;
        }

        $createdAt = now()->toIso8601String();
        $conversation = [
            'id' => (string) Str::uuid(),
            'userId' => (string) $user->id,
            'userEmail' => (string) $user->email,
            'tab' => 'service',
            'name' => 'Support AfriPay',
            'email' => (string) $user->email,
            'role' => 'Support client pour '.(string) $user->name,
            'preview' => 'Bienvenue. Posez votre question et notre equipe prendra le relais.',
            'time' => $this->toTimeLabel($createdAt),
            'status' => 'en ligne',
            'aiEnabled' => false,
            'messages' => [
                [
                    'id' => (string) Str::uuid(),
                    'side' => 'left',
                    'text' => 'Bienvenue sur votre espace support AfriPay. Vous pouvez poser ici vos questions sur vos commandes, devis, paiements et favoris.',
                    'createdAt' => $createdAt,
                ],
            ],
            'createdAt' => $createdAt,
            'updatedAt' => $createdAt,
        ];

        $this->writeJsonFile($this->supportConversationsRuntimePath(), [$conversation, ...$conversations]);

        return $conversation;
    }

    public function appendSupportConversationMessage(User $user, string $conversationId, string $text): array
    {
        $trimmedText = trim($text);
        if ($trimmedText === '') {
            throw new \RuntimeException('Message vide.');
        }

        $conversations = $this->readJsonFile($this->supportConversationsRuntimePath(), $this->supportConversationsSeedPath(), []);
        $conversation = collect($conversations)->first(fn (array $entry) => ($entry['id'] ?? null) === $conversationId && ($entry['userId'] ?? null) === (string) $user->id);
        if (! $conversation) {
            throw new \RuntimeException('Conversation introuvable.');
        }

        $now = now()->toIso8601String();
        $nextConversation = [
            ...$conversation,
            'preview' => $trimmedText,
            'time' => $this->toTimeLabel($now),
            'updatedAt' => $now,
            'messages' => [
                ...($conversation['messages'] ?? []),
                [
                    'id' => (string) Str::uuid(),
                    'side' => 'right',
                    'text' => $trimmedText,
                    'createdAt' => $now,
                ],
            ],
        ];

        $nextConversations = array_map(fn (array $entry) => ($entry['id'] ?? null) === $conversationId ? $nextConversation : $entry, $conversations);
        $sorted = collect($nextConversations)
            ->sortByDesc(fn (array $entry) => $entry['updatedAt'] ?? '')
            ->values()
            ->all();
        $this->writeJsonFile($this->supportConversationsRuntimePath(), $sorted);

        return $nextConversation;
    }

    public function openQuickStartConversation(User $user, string $topic): array
    {
        $conversation = $this->ensureDefaultSupportConversation($user);
        $message = $topic === 'refund'
            ? 'Bonjour AfriPay, j\'ai besoin d\'une assistance remboursement ou après-vente. Je vous écris depuis le centre d\'assistance.'
            : 'Bonjour AfriPay, j\'ai besoin d\'une assistance sur une commande. Je vous écris depuis le centre d\'assistance.';

        return $this->appendSupportConversationMessage($user, (string) $conversation['id'], $message);
    }

    protected function quoteRequestsRuntimePath(): string
    {
        return storage_path('app/private/customer/quote-requests.json');
    }

    protected function quoteRequestsSeedPath(): string
    {
        return base_path('data/customer/quote-requests.json');
    }

    protected function supportConversationsRuntimePath(): string
    {
        return storage_path('app/private/customer/support-conversations.json');
    }

    protected function supportConversationsSeedPath(): string
    {
        return base_path('data/customer/support-conversations.json');
    }

    protected function abandonedQuotesRuntimePath(): string
    {
        return storage_path('app/private/customer/abandoned-quotes.json');
    }

    protected function abandonedQuotesSeedPath(): string
    {
        return base_path('data/customer/abandoned-quotes.json');
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

    protected function normalizeOptionalString(mixed $value): ?string
    {
        $normalized = is_string($value) ? trim($value) : '';

        return $normalized !== '' ? $normalized : null;
    }

    protected function toTimeLabel(string $isoDate): string
    {
        return now()->parse($isoDate)->format('d/m H:i');
    }
}