<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PartnerOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'partner_id',
        'order_id',
        'margin',
        'selling_price',
        'quantity',
        'status',
    ];

    protected $casts = [
        'margin' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'quantity' => 'integer',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(ApiPartner::class, 'partner_id');
    }

    public function transaction(): HasOne
    {
        return $this->hasOne(PartnerTransaction::class);
    }
}