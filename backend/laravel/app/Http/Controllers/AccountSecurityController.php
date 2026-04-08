<?php

namespace App\Http\Controllers;

use App\Models\CustomerAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

class AccountSecurityController extends Controller
{
    public function changeEmail(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $validated = $request->validate([
            'newEmail' => ['required', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'password' => ['required', 'string'],
        ]);

        if (! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Mot de passe incorrect.',
            ], 400);
        }

        $user->forceFill([
            'email' => strtolower($validated['newEmail']),
        ])->save();

        return response()->json([
            'ok' => true,
            'email' => $user->email,
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $validated = $request->validate([
            'currentPassword' => ['required', 'string'],
            'newPassword' => ['required', 'string', 'min:8'],
            'confirmPassword' => ['required', 'same:newPassword'],
        ], [
            'confirmPassword.same' => 'La confirmation du mot de passe ne correspond pas.',
        ]);

        if (! Hash::check($validated['currentPassword'], $user->password)) {
            return response()->json([
                'message' => 'Le mot de passe actuel est incorrect.',
            ], 400);
        }

        $user->forceFill([
            'password' => $validated['newPassword'],
        ])->save();

        return response()->json([
            'ok' => true,
        ]);
    }

    public function delete(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $validated = $request->validate([
            'confirmation' => ['required', 'string'],
            'password' => ['nullable', 'string'],
        ]);

        if (trim($validated['confirmation']) !== 'SUPPRIMER') {
            return response()->json([
                'message' => 'Tapez SUPPRIMER pour confirmer.',
            ], 400);
        }

        if (! Hash::check((string) ($validated['password'] ?? ''), $user->password)) {
            return response()->json([
                'message' => 'Mot de passe incorrect.',
            ], 400);
        }

        CustomerAddress::query()->where('user_id', $user->id)->delete();
        PersonalAccessToken::query()->where('tokenable_type', $user::class)->where('tokenable_id', $user->id)->delete();
        $user->delete();

        return response()->json([
            'ok' => true,
        ]);
    }
}