<?php

namespace App\Erp\Support;

use App\Models\RoleMenuItem;
use Illuminate\Support\Facades\DB;

final class RoleMenus
{
    /** @var list<string> */
    public const KEYS = [
        'dashboard',
        'settings',
        'plan',
        'monitoring',
        'my-reports',
        'products',
        'customers',
        'routes',
        'gallery',
        'tasks',
        'day',
        'promos',
        'orders',
        'inventory',
        'deliveries',
        'invoices',
        'returns',
        'collections',
        'reports',
    ];

    /** @var array<string, list<string>> */
    public const DEFAULTS = [
        'admin' => [
            'dashboard', 'settings', 'plan', 'monitoring', 'products', 'customers', 'routes', 'gallery', 'tasks', 'day',
            'promos', 'orders', 'inventory', 'deliveries', 'invoices', 'returns', 'collections', 'reports',
        ],
        'sales_rep' => [
            'dashboard', 'plan', 'my-reports', 'products', 'customers', 'orders', 'invoices', 'returns', 'collections',
        ],
        'supervisor' => [
            'dashboard', 'plan', 'monitoring', 'routes', 'gallery', 'tasks', 'day', 'promos',
        ],
        'manager' => [
            'dashboard', 'plan', 'monitoring', 'routes', 'gallery', 'tasks', 'day', 'promos',
        ],
        'warehouse' => [
            'dashboard', 'orders', 'inventory',
        ],
        'driver' => [
            'dashboard', 'deliveries',
        ],
    ];

    /**
     * @return list<string>
     */
    public static function forRole(string $role): array
    {
        $keys = RoleMenuItem::query()
            ->where('role_name', $role)
            ->pluck('menu_key')
            ->map(fn ($key) => (string) $key)
            ->all();
        if ($keys === [] && isset(self::DEFAULTS[$role])) {
            $keys = self::DEFAULTS[$role];
        }

        return self::withAdminSettings($role, array_values(array_intersect(self::KEYS, $keys)));
    }

    /**
     * @param  list<string>  $menus
     * @return list<string>
     */
    public static function replace(string $role, array $menus): array
    {
        $keys = self::withAdminSettings($role, array_values(array_unique(array_intersect(self::KEYS, $menus))));

        DB::transaction(function () use ($role, $keys): void {
            RoleMenuItem::query()->where('role_name', $role)->delete();
            foreach ($keys as $key) {
                RoleMenuItem::query()->create([
                    'role_name' => $role,
                    'menu_key' => $key,
                ]);
            }
        });

        return $keys;
    }

    public static function seed(): void
    {
        $rows = [];
        foreach (self::DEFAULTS as $role => $keys) {
            foreach ($keys as $key) {
                $rows[] = [
                    'role_name' => $role,
                    'menu_key' => $key,
                ];
            }
        }
        DB::table('role_menu_items')->insert($rows);
    }

    /**
     * @param  list<string>  $keys
     * @return list<string>
     */
    private static function withAdminSettings(string $role, array $keys): array
    {
        if ($role === 'admin' && ! in_array('settings', $keys, true)) {
            $keys[] = 'settings';
        }

        return array_values($keys);
    }
}
