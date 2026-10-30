<?php

namespace App\Erp\Support;

use App\Enums\UserRole;
use App\Erp\Exceptions\ErpException;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class TeamAccess
{
    public static function role(User $actor): UserRole
    {
        $role = $actor->role;
        if ($role instanceof UserRole) {
            return $role;
        }
        $text = trim((string) $role);
        if (mb_strtolower($text, 'UTF-8') === 'manager') {
            return UserRole::Manager;
        }
        $known = UserRole::tryFrom($text);
        if ($known === null) {
            self::deny();
        }

        return $known;
    }

    public static function deny(): void
    {
        throw new ErpException('FIELD_FORBIDDEN', 'ეს ჩანაწერი ხელმისაწვდომი არ არის.', 403);
    }

    public static function isTeamLead(User $actor): bool
    {
        $role = self::role($actor);

        return $role === UserRole::Supervisor || $role === UserRole::Manager;
    }

    /**
     * @return list<int>|null
     */
    public static function salesUserIds(User $actor): ?array
    {
        $role = self::role($actor);
        if ($role === UserRole::Admin) {
            return null;
        }
        if ($role === UserRole::Supervisor) {
            return User::query()
                ->where('role', UserRole::SalesRep)
                ->whereIn('id', function ($sub) use ($actor): void {
                    $sub->select('sales_user_id')
                        ->from('supervisor_sales')
                        ->where('supervisor_user_id', $actor->id);
                })
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }
        if ($role === UserRole::Manager) {
            return User::query()
                ->where('role', UserRole::SalesRep)
                ->whereIn('id', function ($sub) use ($actor): void {
                    $sub->select('sales_user_id')
                        ->from('manager_sales')
                        ->where('manager_user_id', $actor->id);
                })
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }
        if ($role === UserRole::SalesRep) {
            return [(int) $actor->id];
        }

        self::deny();
    }

    /**
     * @param  Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @return Builder<\Illuminate\Database\Eloquent\Model>
     */
    public static function scopeSales(Builder $query, User $actor, string $column = 'user_id'): Builder
    {
        $ids = self::salesUserIds($actor);
        if ($ids === null) {
            return $query;
        }

        return $query->whereIn($column, $ids === [] ? [-1] : $ids);
    }

    public static function assertSales(User $actor, int $salesUserId): User
    {
        $target = User::query()->whereKey($salesUserId)->where('role', UserRole::SalesRep)->first();
        $ids = self::salesUserIds($actor);
        if (! $target || ($ids !== null && ! in_array((int) $target->id, $ids, true))) {
            throw new ErpException('FORBIDDEN_PRESELLER', 'ამ სეილს რეპის მარშრუტი არ გეკუთვნით.', 403);
        }

        return $target;
    }

    public static function assertSupervisor(User $actor): void
    {
        $role = self::role($actor);
        if ($role !== UserRole::Supervisor && $role !== UserRole::Manager && $role !== UserRole::Admin) {
            self::deny();
        }
    }
}
