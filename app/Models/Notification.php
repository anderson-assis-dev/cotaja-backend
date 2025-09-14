<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'message',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    // Tipos de notificação
    const TYPE_NEW_ORDER = 'new_order';
    const TYPE_NEW_PROPOSAL = 'new_proposal';
    const TYPE_PROPOSAL_ACCEPTED = 'proposal_accepted';
    const TYPE_PROPOSAL_REJECTED = 'proposal_rejected';

    // Relacionamentos
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // Scopes
    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }

    public function scopeRead($query)
    {
        return $query->whereNotNull('read_at');
    }

    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    // Helpers
    public function isRead(): bool
    {
        return !is_null($this->read_at);
    }

    public function markAsRead(): void
    {
        $this->update(['read_at' => now()]);
    }
}
