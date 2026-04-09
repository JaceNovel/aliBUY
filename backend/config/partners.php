<?php

return [
    'allowed_ips' => array_values(array_filter(array_map(
        static fn (string $value): string => trim($value),
        explode(',', (string) env('PARTNER_API_ALLOWED_IPS', ''))
    ))),
    'signature_ttl' => (int) env('PARTNER_API_SIGNATURE_TTL', 300),
];