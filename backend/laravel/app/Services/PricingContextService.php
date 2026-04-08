<?php

namespace App\Services;

use Illuminate\Http\Request;

class PricingContextService
{
    protected const CURRENCIES = [
        'EUR' => ['code' => 'EUR', 'label' => 'Euro', 'rateFromUsd' => 0.92],
        'USD' => ['code' => 'USD', 'label' => 'US Dollar', 'rateFromUsd' => 1.0],
        'GBP' => ['code' => 'GBP', 'label' => 'Livre sterling', 'rateFromUsd' => 0.78],
        'CAD' => ['code' => 'CAD', 'label' => 'Dollar canadien', 'rateFromUsd' => 1.36],
        'MAD' => ['code' => 'MAD', 'label' => 'Dirham marocain', 'rateFromUsd' => 9.92],
        'XOF' => ['code' => 'XOF', 'label' => 'Franc CFA', 'rateFromUsd' => 602.0],
        'GHS' => ['code' => 'GHS', 'label' => 'Cedi ghanéen', 'rateFromUsd' => 15.5],
    ];

    protected const COUNTRIES = [
        'FR' => ['countryLabel' => 'France', 'defaultLanguage' => 'fr', 'defaultCurrency' => 'EUR', 'shippingWindow' => '4 à 8 jours', 'flagEmoji' => '🇫🇷'],
        'BE' => ['countryLabel' => 'Belgique', 'defaultLanguage' => 'fr', 'defaultCurrency' => 'EUR', 'shippingWindow' => '4 à 8 jours', 'flagEmoji' => '🇧🇪'],
        'CH' => ['countryLabel' => 'Suisse', 'defaultLanguage' => 'fr', 'defaultCurrency' => 'EUR', 'shippingWindow' => '5 à 9 jours', 'flagEmoji' => '🇨🇭'],
        'CA' => ['countryLabel' => 'Canada', 'defaultLanguage' => 'fr', 'defaultCurrency' => 'CAD', 'shippingWindow' => '5 à 10 jours', 'flagEmoji' => '🇨🇦'],
        'MA' => ['countryLabel' => 'Maroc', 'defaultLanguage' => 'fr', 'defaultCurrency' => 'MAD', 'shippingWindow' => '6 à 12 jours', 'flagEmoji' => '🇲🇦'],
        'GB' => ['countryLabel' => 'United Kingdom', 'defaultLanguage' => 'en', 'defaultCurrency' => 'GBP', 'shippingWindow' => '4 to 7 days', 'flagEmoji' => '🇬🇧'],
        'US' => ['countryLabel' => 'United States', 'defaultLanguage' => 'en', 'defaultCurrency' => 'USD', 'shippingWindow' => '3 to 6 days', 'flagEmoji' => '🇺🇸'],
        'BJ' => ['countryLabel' => 'Bénin', 'defaultLanguage' => 'fr', 'defaultCurrency' => 'XOF', 'shippingWindow' => '7 à 13 jours', 'flagEmoji' => '🇧🇯'],
        'GH' => ['countryLabel' => 'Ghana', 'defaultLanguage' => 'en', 'defaultCurrency' => 'GHS', 'shippingWindow' => '6 to 11 days', 'flagEmoji' => '🇬🇭'],
        'CI' => ['countryLabel' => 'Côte d\'Ivoire', 'defaultLanguage' => 'fr', 'defaultCurrency' => 'XOF', 'shippingWindow' => '7 à 12 jours', 'flagEmoji' => '🇨🇮'],
        'BF' => ['countryLabel' => 'Burkina Faso', 'defaultLanguage' => 'fr', 'defaultCurrency' => 'XOF', 'shippingWindow' => '7 à 13 jours', 'flagEmoji' => '🇧🇫'],
        'TG' => ['countryLabel' => 'Togo', 'defaultLanguage' => 'fr', 'defaultCurrency' => 'XOF', 'shippingWindow' => '7 à 12 jours', 'flagEmoji' => '🇹🇬'],
        'AE' => ['countryLabel' => 'United Arab Emirates', 'defaultLanguage' => 'en', 'defaultCurrency' => 'USD', 'shippingWindow' => '5 to 10 days', 'flagEmoji' => '🇦🇪'],
    ];

    protected const LANGUAGES = [
        'fr' => ['code' => 'fr', 'label' => 'Français', 'locale' => 'fr-FR'],
        'en' => ['code' => 'en', 'label' => 'English', 'locale' => 'en-US'],
    ];

    protected const ACCEPT_LANGUAGE_TO_COUNTRY = [
        'fr-fr' => 'FR',
        'fr-be' => 'BE',
        'fr-ch' => 'CH',
        'fr-ca' => 'CA',
        'fr-ma' => 'MA',
        'fr-bj' => 'BJ',
        'en-gh' => 'GH',
        'fr-ci' => 'CI',
        'fr-bf' => 'BF',
        'fr-tg' => 'TG',
        'en-gb' => 'GB',
        'en-us' => 'US',
        'fr' => 'FR',
        'en' => 'US',
    ];

    public function build(Request $request): array
    {
        $countryCode = $this->detectCountry($request, $request->query('country'));
        $country = self::COUNTRIES[$countryCode] ?? self::COUNTRIES['FR'];
        $languageCode = $this->normalizeLanguage($request->query('language'))
            ?? $this->normalizeLanguage($request->cookie('afri_language'))
            ?? $country['defaultLanguage'];
        $language = self::LANGUAGES[$languageCode] ?? self::LANGUAGES[$country['defaultLanguage']];
        $currencyCode = $this->normalizeCurrency($request->query('currency'))
            ?? $this->normalizeCurrency($request->cookie('afri_currency'))
            ?? $country['defaultCurrency'];
        $currency = self::CURRENCIES[$currencyCode] ?? self::CURRENCIES[$country['defaultCurrency']];

        return [
            'countryCode' => $countryCode,
            'countryLabel' => $country['countryLabel'],
            'languageCode' => $language['code'],
            'languageLabel' => $language['label'].'-'.$currency['code'],
            'currency' => $currency['code'],
            'shippingWindow' => $country['shippingWindow'],
            'exchangeLabel' => '1 USD = '.$this->formatNumber((float) $currency['rateFromUsd'], $language['locale']).' '.$currency['code'],
            'samples' => [
                'mouse' => $this->formatPrice(29.9, $language['locale'], $currency['code'], (float) $currency['rateFromUsd']),
                'chair' => $this->formatPrice(219, $language['locale'], $currency['code'], (float) $currency['rateFromUsd']),
                'packaging' => $this->formatPrice(485.2, $language['locale'], $currency['code'], (float) $currency['rateFromUsd']),
            ],
        ];
    }

    protected function detectCountry(Request $request, mixed $explicitCountry): string
    {
        $candidates = [
            $this->normalizeCountry($explicitCountry),
            $this->normalizeCountry($request->cookie('afri_country')),
            $this->normalizeCountry($request->header('x-vercel-ip-country')),
            $this->normalizeCountry($request->header('cf-ipcountry')),
            $this->normalizeCountry($request->header('cloudfront-viewer-country')),
            $this->normalizeCountry($request->header('x-country-code')),
        ];

        foreach ($candidates as $candidate) {
            if ($candidate && isset(self::COUNTRIES[$candidate])) {
                return $candidate;
            }
        }

        $acceptLanguage = strtolower((string) $request->header('accept-language', ''));
        foreach (self::ACCEPT_LANGUAGE_TO_COUNTRY as $fragment => $countryCode) {
            if ($acceptLanguage !== '' && str_contains($acceptLanguage, $fragment)) {
                return $countryCode;
            }
        }

        return 'FR';
    }

    protected function normalizeCountry(mixed $value): ?string
    {
        $country = strtoupper(trim((string) ($value ?? '')));

        return $country !== '' ? $country : null;
    }

    protected function normalizeCurrency(mixed $value): ?string
    {
        $currency = strtoupper(trim((string) ($value ?? '')));

        return $currency !== '' && isset(self::CURRENCIES[$currency]) ? $currency : null;
    }

    protected function normalizeLanguage(mixed $value): ?string
    {
        $language = strtolower(trim((string) ($value ?? '')));

        return $language !== '' && isset(self::LANGUAGES[$language]) ? $language : null;
    }

    protected function formatPrice(float $amountUsd, string $locale, string $currency, float $rateFromUsd): string
    {
        $localizedAmount = $amountUsd * $rateFromUsd;
        $decimals = $localizedAmount >= 100 ? 0 : 2;
        $number = $this->formatNumber($localizedAmount, $locale, $decimals);

        return str_starts_with($locale, 'fr') ? $number.' '.$currency : $currency.' '.$number;
    }

    protected function formatNumber(float $value, string $locale, int $decimals = 2): string
    {
        $decimalSeparator = str_starts_with($locale, 'fr') ? ',' : '.';
        $thousandsSeparator = str_starts_with($locale, 'fr') ? ' ' : ',';

        return number_format($value, $decimals, $decimalSeparator, $thousandsSeparator);
    }
}