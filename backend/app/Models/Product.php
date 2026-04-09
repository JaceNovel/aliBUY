<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Product extends Model
{
    use HasFactory;

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    protected $fillable = [
        'source_provider',
        'source_product_id',
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
        'is_published',
        'metadata',
        'views_count',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'gallery' => 'array',
        'metadata' => 'array',
        'is_published' => 'boolean',
    ];

    public function getPrimaryImageUrlAttribute(): ?string
    {
        return $this->image ?: ($this->gallery[0] ?? null);
    }

    public function orders(): BelongsToMany
    {
        return $this->belongsToMany(Order::class, 'order_items')
            ->withPivot(['quantity', 'unit_price', 'line_total', 'title_snapshot', 'image_snapshot'])
            ->withTimestamps();
    }
}
