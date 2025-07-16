<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'category',
        'budget',
        'deadline',
        'address',
        'status',
        'client_id',
        'provider_id',
        'accepted_proposal_id',
        'auction_started_at',
        'auction_ends_at',
    ];

    protected $casts = [
        'budget' => 'decimal:2',
        'deadline' => 'integer', // Mudando de string para integer
        'auction_started_at' => 'datetime',
        'auction_ends_at' => 'datetime',
    ];

    // Status possíveis do pedido
    const STATUS_OPEN = 'open';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_COMPLETED = 'completed';
    const STATUS_CANCELLED = 'cancelled';

    // Relacionamentos
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'provider_id');
    }

    public function proposals(): HasMany
    {
        return $this->hasMany(Proposal::class);
    }

    public function acceptedProposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class, 'accepted_proposal_id');
    }

    // Relacionamento polimórfico com attachments
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    // Scopes
    public function scopeOpen($query)
    {
        return $query->where('status', self::STATUS_OPEN);
    }

    public function scopeByClient($query, $clientId)
    {
        return $query->where('client_id', $clientId);
    }

    public function scopeByProvider($query, $providerId)
    {
        return $query->where('provider_id', $providerId);
    }

    public function scopeByCategory($query, $category)
    {
        return $query->where('category', $category);
    }

    // Métodos para verificar status do leilão
    public function isAuctionActive(): bool
    {
        return $this->auction_started_at && 
               $this->auction_ends_at && 
               now()->between($this->auction_started_at, $this->auction_ends_at);
    }

    public function isAuctionExpired(): bool
    {
        return $this->auction_ends_at && now()->isAfter($this->auction_ends_at);
    }

    public function canStartAuction(): bool
    {
        return $this->status === self::STATUS_OPEN && !$this->auction_started_at;
    }

    public function getAuctionTimeRemaining(): ?string
    {
        if (!$this->auction_ends_at) {
            return null;
        }

        $remaining = $this->auction_ends_at->diff(now());
        
        if ($remaining->invert === 0) {
            return 'Expirado';
        }

        if ($remaining->days > 0) {
            return $remaining->days . ' dia' . ($remaining->days > 1 ? 's' : '');
        }

        if ($remaining->h > 0) {
            return $remaining->h . ' hora' . ($remaining->h > 1 ? 's' : '');
        }

        return $remaining->i . ' minuto' . ($remaining->i > 1 ? 's' : '');
    }
} 