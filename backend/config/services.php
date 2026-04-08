<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'frontend' => [
        'url' => env('FRONTEND_URL', 'http://localhost:3000'),
    ],

    'moneroo' => [
        'base_url' => env('MONEROO_API_BASE_URL', 'https://api.moneroo.io'),
        'api_key' => env('MONEROO_API_KEY'),
        'secret_key' => env('MONEROO_SECRET_KEY', env('MONEROO_SECRET')),
        'webhook_secret' => env('MONEROO_WEBHOOK_SECRET', env('MONEROO_SECRET_KEY', env('MONEROO_SECRET'))),
        'methods' => array_values(array_filter(array_map('trim', explode(',', (string) env('MONEROO_PAYMENT_METHODS', ''))))),
    ],

    'fedapay' => [
        'base_url' => env('FEDAPAY_API_BASE_URL', 'https://api.fedapay.com/v1'),
        'api_key' => env('FEDAPAY_API_KEY'),
        'secret_key' => env('FEDAPAY_SECRET_KEY'),
        'webhook_secret' => env('FEDAPAY_WEBHOOK_SECRET'),
        'environment' => env('FEDAPAY_ENVIRONMENT', 'live'),
    ],

];
