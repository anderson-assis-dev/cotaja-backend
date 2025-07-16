<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Attachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'filename',
        'original_name',
        'file_path',
        'file_size',
        'mime_type',
        'attachable_type',
        'attachable_id',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    // Relacionamento polimórfico
    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }

    // Helpers
    public function getFullPathAttribute()
    {
        return storage_path('app/' . $this->file_path);
    }

    public function getUrlAttribute()
    {
        return url('storage/' . $this->file_path);
    }

    public function isImage()
    {
        return str_starts_with($this->mime_type, 'image/');
    }

    public function isPdf()
    {
        return $this->mime_type === 'application/pdf';
    }
} 