<?php

namespace App\Filament\Widgets;

use App\Models\Customer;
use App\Models\Order;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends StatsOverviewWidget
{
    protected static ?int $sort = 0;

    protected function getStats(): array
    {
        $startOfMonth = now()->startOfMonth();
        $endOfMonth = now()->endOfMonth();

        return [
            Stat::make('Total Orders (This Month)', Order::whereBetween('created_at', [$startOfMonth, $endOfMonth])->count())
                ->icon('heroicon-o-shopping-cart'),
            Stat::make('Total Revenue (This Month)', '₾' . number_format(
                Order::whereBetween('created_at', [$startOfMonth, $endOfMonth])->sum('total'),
                2
            ))
                ->icon('heroicon-o-currency-dollar'),
            Stat::make('Pending Orders', Order::where('status', 'pending')->count())
                ->icon('heroicon-o-clock'),
            Stat::make('Active Customers', Customer::where('is_active', true)->count())
                ->icon('heroicon-o-user-group'),
        ];
    }
}
