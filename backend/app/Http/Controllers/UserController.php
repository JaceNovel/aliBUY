<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function me(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');

        return response()->json([
            'user' => [
                'id' => (string) $user->id,
                'email' => $user->email,
                'displayName' => $user->name,
                'firstName' => str($user->name)->before(' ')->value(),
                'createdAt' => optional($user->created_at)->toIso8601String(),
            ],
        ]);
    }
}