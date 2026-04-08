<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'order_number',
        'customer_name',
        'customer_phone',
        'user_info',
        'customer_email',
        'address_line1',
        'address_line2',
        'city',
        'state',
        'postal_code',
        'country_code',
        'items',
        'total_price',
        'status',
        'payment_status',
        'payment_currency',
        'payment_provider',
        'payment_reference',
        'payment_checkout_url',
        'payment_provider_payload',
        'shipping_method',
        'meta',
    ];

    protected $casts = [
        'user_info' => 'array',
        'items' => 'array',
        'meta' => 'array',
        'payment_provider_payload' => 'array',
        'total_price' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
