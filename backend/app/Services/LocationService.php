<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LocationService
{
    public function reverseGeocode(float $latitude, float $longitude, Request $request): array
    {
        $countryCode = strtoupper((string) ($request->header('x-country-code')
            ?? $request->header('x-vercel-ip-country')
            ?? $request->header('cf-ipcountry')
            ?? 'CI'));

        return [
            'addressLine1' => 'Position GPS '.$latitude.', '.$longitude,
            'addressLine2' => null,
            'city' => 'Position actuelle',
            'state' => 'Position actuelle',
            'postalCode' => null,
            'countryCode' => $countryCode,
            'displayName' => 'Position GPS '.$latitude.', '.$longitude,
        ];
    }

    public function resolveMapsLink(string $url): array
    {
        $decodedUrl = urldecode($url);
        $coordinates = $this->extractCoordinates($decodedUrl);

        if (! $coordinates) {
            abort(422, 'Le lien Google Maps doit contenir des coordonnees lisibles.');
        }

        return [
            'coordinates' => $coordinates,
        ];
    }

    protected function extractCoordinates(string $url): ?array
    {
        $patterns = [
            '/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/',
            '/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/',
            '/[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/',
            '/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $url, $matches) === 1) {
                return [
                    'latitude' => (float) $matches[1],
                    'longitude' => (float) $matches[2],
                ];
            }
        }

        return null;
    }
}