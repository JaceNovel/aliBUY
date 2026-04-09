<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'order_number',
        'product_id',
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
        'base_price',
        'quantity',
        'total_price',
        'status',
        'payment_status',
        'payment_currency',
        'payment_provider',
        'payment_reference',
        'payment_checkout_url',
        'tracking_reference',
        'payment_provider_payload',
        'shipping_method',
        'meta',
    ];

    protected $casts = [
        'user_info' => 'array',
        'items' => 'array',
        'meta' => 'array',
        'payment_provider_payload' => 'array',
        'base_price' => 'decimal:2',
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

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function trackingEvents(): HasMany
    {
        return $this->hasMany(OrderTracking::class)->latest();
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'order_items')
            ->withPivot(['quantity', 'unit_price', 'line_total', 'title_snapshot', 'image_snapshot'])
            ->withTimestamps();
    }

    public function partnerOrder(): HasOne
    {
        return $this->hasOne(PartnerOrder::class);
    }
}
