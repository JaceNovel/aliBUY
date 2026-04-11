<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::query()->create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'phone' => $validated['phone'] ?? null,
            'password' => $validated['password'],
        ]);

        $token = $user->createToken('frontend')->plainTextToken;

        return response()->json([
            'user' => $this->transformUser($user),
            'token' => $token,
            'tokenType' => 'Bearer',
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', strtolower($validated['email']))->first();
        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Identifiants invalides.',
            ]);
        }

        $token = $user->createToken('frontend')->plainTextToken;

        return response()->json([
            'user' => $this->transformUser($user),
            'token' => $token,
            'tokenType' => 'Bearer',
        ]);
    }

    public function adminLogin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', strtolower($validated['email']))->first();
        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Identifiants invalides.',
            ]);
        }

        if (! $user->hasAdminAccess()) {
            throw ValidationException::withMessages([
                'email' => "Ce compte n'a pas acces a l'administration.",
            ]);
        }

        $token = $user->createToken('frontend-admin')->plainTextToken;

        return response()->json([
            'user' => $this->transformUser($user),
            'token' => $token,
            'tokenType' => 'Bearer',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user('sanctum')?->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    protected function transformUser(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->effective_role,
            'createdAt' => optional($user->created_at)->toIso8601String(),
        ];
    }
}