<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class AccountProfileController extends Controller
{
    public function uploadPhoto(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120'],
        ], [
            'file.required' => 'Fichier manquant.',
            'file.mimetypes' => 'Format non pris en charge. Utilisez JPG, PNG ou WEBP.',
            'file.max' => 'Le fichier dépasse 5 Mo.',
        ]);

        $file = $validated['file'];
        $extension = match ($file->getMimeType()) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => null,
        };

        if ($extension === null) {
            return response()->json([
                'message' => 'Format non pris en charge. Utilisez JPG, PNG ou WEBP.',
            ], 400);
        }

        $directory = public_path('uploads/profile-images');
        File::ensureDirectoryExists($directory);

        $filename = $user->id.'-'.Str::uuid()->toString().'.'.$extension;
        $file->move($directory, $filename);

        $relativeUrl = '/uploads/profile-images/'.$filename;
        $profilePhotoUrl = rtrim((string) config('app.url'), '/').$relativeUrl;
        $settings = array_merge($user->settings ?? [], [
            'profilePhotoUrl' => $profilePhotoUrl,
        ]);

        $user->forceFill([
            'settings' => $settings,
        ])->save();

        return response()->json([
            'profilePhotoUrl' => $profilePhotoUrl,
        ]);
    }
}