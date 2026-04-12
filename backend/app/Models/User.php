<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'role',
        'settings',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'settings' => 'array',
        ];
    }

    public function isConfiguredSuperAdmin(): bool
    {
        $configuredEmail = strtolower(trim((string) config('services.admin.email', '')));
        $currentEmail = strtolower(trim((string) $this->email));

        return $configuredEmail !== '' && $currentEmail === $configuredEmail;
    }

    public function hasAdminAccess(): bool
    {
        return $this->isConfiguredSuperAdmin() || in_array($this->role, ['admin', 'super_admin'], true);
    }

    public function getEffectiveRoleAttribute(): ?string
    {
        return $this->isConfiguredSuperAdmin() ? 'super_admin' : $this->role;
    }
}