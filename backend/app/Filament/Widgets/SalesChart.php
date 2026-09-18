<?php

namespace App\Filament\Widgets;

use App\Models\Order;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class SalesChart extends ChartWidget
{
    protected ?string $heading = 'Sales Overview (Last 30 Days)';

    protected static ?int $sort = 1;

    protected function getData(): array
    {
        $days = collect(range(29, 0))->map(fn ($daysAgo) => Carbon::today()->subDays($daysAgo));

        $salesByDay = Order::where('created_at', '>=', now()->subDays(30))
            ->selectRaw('DATE(created_at) as date, SUM(total) as total')
            ->groupBy('date')
            ->pluck('total', 'date')
            ->toArray();

        return [
            'datasets' => [
                [
                    'label' => 'Daily Sales (₾)',
                    'data' => $days->map(fn (Carbon $day) => (float) ($salesByDay[$day->toDateString()] ?? 0))->toArray(),
                    'borderColor' => '#6366f1',
                    'backgroundColor' => 'rgba(99, 102, 241, 0.1)',
                    'fill' => true,
                ],
            ],
            'labels' => $days->map(fn (Carbon $day) => $day->format('M d'))->toArray(),
        ];
    }

    protected function getType(): string
    {
        return 'line';
    }
}
