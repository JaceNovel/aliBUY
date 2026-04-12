<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartnerWithdrawal extends Model
{
    use HasFactory;

    protected $fillable = [
        'partner_id',
        'amount',
        'method',
        'status',
        'bank_account_name',
        'bank_name',
        'iban',
        'swift_code',
        'mobile_money_number',
        'mobile_money_country_code',
        'mobile_money_operator',
        'admin_note',
        'processed_at',
    ];

    protected $casts = [
        'amount' => 'float',
        'processed_at' => 'datetime',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(ApiPartner::class, 'partner_id');
    }
}