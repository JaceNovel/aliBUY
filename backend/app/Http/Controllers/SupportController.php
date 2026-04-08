<?php

namespace App\Http\Controllers;

use App\Services\CustomerInteractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportController extends Controller
{
    public function __construct(
        protected CustomerInteractionService $interactions,
    ) {
    }

    public function quickStart(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $topic = $request->input('topic');

        if (! in_array($topic, ['order', 'refund'], true)) {
            return response()->json([
                'message' => 'Sujet d\'assistance invalide.',
            ], 400);
        }

        $conversation = $this->interactions->openQuickStartConversation($user, (string) $topic);

        return response()->json([
            'ok' => true,
            'conversationId' => $conversation['id'],
        ]);
    }
}