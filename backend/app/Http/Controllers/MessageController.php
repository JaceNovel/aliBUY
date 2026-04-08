<?php

namespace App\Http\Controllers;

use App\Services\CustomerInteractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function __construct(
        protected CustomerInteractionService $interactions,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');

        return response()->json([
            'conversations' => $this->interactions->getUserSupportConversations((string) $user->id),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $validated = $request->validate([
            'conversationId' => ['required', 'string'],
            'text' => ['required', 'string'],
        ]);

        try {
            return response()->json([
                'ok' => true,
                'conversation' => $this->interactions->appendSupportConversationMessage($user, (string) $validated['conversationId'], (string) $validated['text']),
            ]);
        } catch (\Throwable $error) {
            return response()->json([
                'message' => $error instanceof \Exception ? $error->getMessage() : 'Envoi impossible.',
            ], 404);
        }
    }
}