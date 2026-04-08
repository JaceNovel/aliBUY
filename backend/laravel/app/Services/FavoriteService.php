<?php

namespace App\Services;

use App\Models\User;

class FavoriteService
{
    public function isFavorite(User $user, string $productSlug): bool
    {
        return in_array($productSlug, $this->favoriteSlugs($user), true);
    }

    public function toggle(User $user, string $productSlug): array
    {
        $favorites = $this->favoriteSlugs($user);
        $isFavorite = in_array($productSlug, $favorites, true);
        $nextFavorites = $isFavorite
            ? array_values(array_filter($favorites, fn (string $slug) => $slug !== $productSlug))
            : array_values(array_unique([...$favorites, $productSlug]));

        $settings = $user->settings ?? [];
        $settings['favoriteProductSlugs'] = $nextFavorites;
        $user->forceFill([
            'settings' => $settings,
        ])->save();

        return [
            'isFavorite' => ! $isFavorite,
        ];
    }

    protected function favoriteSlugs(User $user): array
    {
        $favorites = $user->settings['favoriteProductSlugs'] ?? [];

        return array_values(array_filter(
            is_array($favorites) ? $favorites : [],
            fn ($value) => is_string($value) && trim($value) !== ''
        ));
    }
}