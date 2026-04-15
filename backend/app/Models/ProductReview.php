<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductReview extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'order_id',
        'user_id',
        'source',
        'source_review_id',
        'reviewer_name',
        'reviewer_email',
        'rating',
        'title',
        'comment',
        'media_urls',
        'verified_purchase',
        'status',
        'submitted_at',
        'published_at',
    ];

    protected $casts = [
        'media_urls' => 'array',
        'verified_purchase' => 'boolean',
        'submitted_at' => 'datetime',
        'published_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}