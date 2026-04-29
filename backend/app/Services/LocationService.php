<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class LocationService
{
    public function reverseGeocode(float $latitude, float $longitude, Request $request): array
    {
        $fallbackCountryCode = strtoupper((string) ($request->header('x-country-code')
            ?? $request->header('x-vercel-ip-country')
            ?? $request->header('cf-ipcountry')
            ?? 'CI'));

        try {
            $response = Http::timeout(12)
                ->retry(1, 250)
                ->acceptJson()
                ->withHeaders([
                    'User-Agent' => 'AfriPay/1.0 (contact@afripay.space)',
                    'Accept-Language' => $this->resolveLanguageHeader($request),
                ])
                ->get('https://nominatim.openstreetmap.org/reverse', [
                    'format' => 'jsonv2',
                    'lat' => $latitude,
                    'lon' => $longitude,
                    'addressdetails' => 1,
                    'namedetails' => 1,
                    'zoom' => 18,
                ]);

            if ($response->ok()) {
                $payload = $response->json();
                if (is_array($payload)) {
                    $address = is_array($payload['address'] ?? null) ? $payload['address'] : [];
                    $countryCode = strtoupper((string) ($address['country_code'] ?? $fallbackCountryCode));
                    $countryLabel = $this->firstNonEmpty([
                        $address['country'] ?? null,
                        $payload['namedetails']['name'] ?? null,
                    ]);
                    $city = $this->firstNonEmpty([
                        $address['city'] ?? null,
                        $address['town'] ?? null,
                        $address['village'] ?? null,
                        $address['municipality'] ?? null,
                        $address['county'] ?? null,
                    ]);
                    $state = $this->firstNonEmpty([
                        $address['state'] ?? null,
                        $address['region'] ?? null,
                        $address['county'] ?? null,
                        $city,
                    ]);
                    $road = $this->firstNonEmpty([
                        $address['road'] ?? null,
                        $address['pedestrian'] ?? null,
                        $address['residential'] ?? null,
                        $address['path'] ?? null,
                        $address['footway'] ?? null,
                    ]);
                    $houseNumber = $this->firstNonEmpty([
                        $address['house_number'] ?? null,
                        $address['building'] ?? null,
                    ]);
                    $suburb = $this->firstNonEmpty([
                        $address['suburb'] ?? null,
                        $address['neighbourhood'] ?? null,
                        $address['quarter'] ?? null,
                        $address['hamlet'] ?? null,
                    ]);
                    $addressLine1 = trim(implode(' ', array_filter([$houseNumber, $road])));
                    if ($addressLine1 === '') {
                        $addressLine1 = $this->firstNonEmpty([
                            $address['amenity'] ?? null,
                            $address['shop'] ?? null,
                            $address['tourism'] ?? null,
                            $suburb,
                            $city,
                            'Position GPS '.$latitude.', '.$longitude,
                        ]);
                    }

                    return [
                        'addressLine1' => $addressLine1,
                        'addressLine2' => $suburb,
                        'city' => $city,
                        'state' => $state,
                        'postalCode' => $this->firstNonEmpty([$address['postcode'] ?? null]),
                        'countryCode' => $countryCode !== '' ? $countryCode : $fallbackCountryCode,
                        'countryLabel' => $countryLabel,
                        'displayName' => $this->firstNonEmpty([
                            $payload['display_name'] ?? null,
                            $addressLine1,
                            $city,
                        ]),
                    ];
                }
            }
        } catch (\Throwable) {
        }

        return [
            'addressLine1' => 'Position GPS '.$latitude.', '.$longitude,
            'addressLine2' => null,
            'city' => 'Position actuelle',
            'state' => 'Position actuelle',
            'postalCode' => null,
            'countryCode' => $fallbackCountryCode,
            'countryLabel' => null,
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

    protected function resolveLanguageHeader(Request $request): string
    {
        $acceptLanguage = trim((string) $request->header('accept-language', ''));

        return $acceptLanguage !== '' ? $acceptLanguage : 'fr,en;q=0.8';
    }

    protected function firstNonEmpty(array $values): ?string
    {
        foreach ($values as $value) {
            if (! is_scalar($value)) {
                continue;
            }

            $normalized = trim((string) $value);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return null;
    }
}