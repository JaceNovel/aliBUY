<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ApiPartnerRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_name',
        'website',
        'email',
        'description',
        'status',
        'decision_reason',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];
}