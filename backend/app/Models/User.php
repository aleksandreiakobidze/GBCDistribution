<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\HasAvatar;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements HasAvatar
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'role',
        'id_gvari',
        'supervisor_id',
        'avatar',
        'is_active',
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
            'id_gvari' => 'integer',
            'supervisor_id' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function getFilamentAvatarUrl(): ?string
    {
        return null;
    }

    /**
     * Known roles stay as the enum the rest of the app compares. A role added
     * in settings is kept as its name and does not unlock those menus.
     */
    protected function role(): Attribute
    {
        return Attribute::make(
            get: function (mixed $value): UserRole|string {
                if ($value instanceof UserRole) {
                    return $value;
                }
                $text = trim((string) $value);
                if (mb_strtolower($text, 'UTF-8') === 'manager') {
                    return UserRole::Manager;
                }

                return UserRole::tryFrom($text) ?? $text;
            },
            set: fn (mixed $value): string => $value instanceof UserRole ? $value->value : trim((string) $value),
        );
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(self::class, 'supervisor_id');
    }

    public function salesReps(): HasMany
    {
        return $this->hasMany(self::class, 'supervisor_id');
    }

    public function salesOrders(): HasMany
    {
        return $this->hasMany(Order::class, 'sales_rep_id');
    }

    public function driverDeliveries(): HasMany
    {
        return $this->hasMany(Delivery::class, 'driver_id');
    }

    public function customerVisits(): HasMany
    {
        return $this->hasMany(CustomerVisit::class);
    }

    public function assignedCustomers(): HasMany
    {
        return $this->hasMany(Customer::class, 'assigned_sales_rep_id');
    }
}
