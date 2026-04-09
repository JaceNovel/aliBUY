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
    ];
}