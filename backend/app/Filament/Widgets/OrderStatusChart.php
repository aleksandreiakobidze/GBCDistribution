<?php

namespace App\Filament\Widgets;

use App\Enums\OrderStatus;
use App\Models\Order;
use Filament\Widgets\ChartWidget;

class OrderStatusChart extends ChartWidget
{
    protected ?string $heading = 'Orders by Status';

    protected static ?int $sort = 2;

    protected function getData(): array
    {
        $statusCounts = Order::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $statuses = OrderStatus::cases();
        $colors = [
            OrderStatus::Pending->value => '#f59e0b',
            OrderStatus::Confirmed->value => '#3b82f6',
            OrderStatus::Picking->value => '#8b5cf6',
            OrderStatus::Packed->value => '#06b6d4',
            OrderStatus::Dispatched->value => '#6366f1',
            OrderStatus::Delivered->value => '#10b981',
            OrderStatus::Cancelled->value => '#ef4444',
        ];

        return [
            'datasets' => [
                [
                    'data' => array_map(fn (OrderStatus $status) => $statusCounts[$status->value] ?? 0, $statuses),
                    'backgroundColor' => array_map(fn (OrderStatus $status) => $colors[$status->value], $statuses),
                ],
            ],
            'labels' => array_map(fn (OrderStatus $status) => ucfirst($status->value), $statuses),
        ];
    }

    protected function getType(): string
    {
        return 'doughnut';
    }
}
