<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'slug',
        'description',
        'price',
        'category',
        'stock',
        'image',
        'gallery',
        'supplier_name',
        'supplier_location',
        'moq',
        'unit',
        'badge',
        'metadata',
        'views_count',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'gallery' => 'array',
        'metadata' => 'array',
    ];
}
