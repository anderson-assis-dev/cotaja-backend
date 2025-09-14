<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'address',
        'profile_type',
        'service_categories',
        'fcm_token',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'service_categories' => 'array',
        ];
    }

    // Relacionamentos
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'client_id');
    }

    public function proposals(): HasMany
    {
        return $this->hasMany(Proposal::class, 'provider_id');
    }

    public function services(): HasMany
    {
        return $this->hasMany(Service::class, 'provider_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(Attachment::class, 'attachable_id')
            ->where('attachable_type', User::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    // Scopes
    public function scopeClients($query)
    {
        return $query->where('profile_type', 'client');
    }

    public function scopeProviders($query)
    {
        return $query->where('profile_type', 'provider');
    }

    // Helpers
    public function isClient()
    {
        return $this->profile_type === 'client';
    }

    public function isProvider()
    {
        return $this->profile_type === 'provider';
    }

    public function providesCategory($category)
    {
        if (!$this->isProvider() || !$this->service_categories) {
            return false;
        }

        return in_array($category, $this->service_categories);
    }
}