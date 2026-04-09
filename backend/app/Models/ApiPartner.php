<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ApiPartner extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_name',
        'email',
        'app_key',
        'app_secret',
        'webhook_url',
        'is_active',
    ];

    protected $hidden = [
        'app_secret',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function logs(): HasMany
    {
        return $this->hasMany(ApiLog::class, 'partner_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(PartnerOrder::class, 'partner_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(PartnerTransaction::class, 'partner_id');
    }

    public function wallet(): HasOne
    {
        return $this->hasOne(PartnerWallet::class, 'partner_id');
    }
}