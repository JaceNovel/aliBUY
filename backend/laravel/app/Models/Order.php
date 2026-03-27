<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_number',
        'user_info',
        'customer_email',
        'total_price',
        'status',
        'payment_status',
        'payment_currency',
        'shipping_method',
        'meta',
    ];

    protected $casts = [
        'user_info' => 'array',
        'meta' => 'array',
        'total_price' => 'decimal:2',
    ];

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
