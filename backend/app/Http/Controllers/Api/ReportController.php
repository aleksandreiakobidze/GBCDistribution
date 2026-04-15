<?php

namespace App\Http\Controllers\Api;

use App\Models\Category;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\CustomerVisit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends BaseController
{
    public function sales(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $dateFrom = $request->date_from ?? now()->startOfMonth()->toDateString();
        $dateTo = $request->date_to ?? now()->toDateString();

        $orders = Order::whereBetween('ordered_at', [$dateFrom, $dateTo . ' 23:59:59']);

        $totalSales = (clone $orders)->sum('total');
        $totalOrders = (clone $orders)->count();
        $averageOrderValue = $totalOrders > 0 ? $totalSales / $totalOrders : 0;

        $topProducts = OrderItem::select(
                'product_id',
                DB::raw('SUM(quantity) as total_quantity'),
                DB::raw('SUM(line_total) as total_revenue')
            )
            ->whereHas('order', function ($q) use ($dateFrom, $dateTo) {
                $q->whereBetween('ordered_at', [$dateFrom, $dateTo . ' 23:59:59']);
            })
            ->groupBy('product_id')
            ->orderByDesc('total_quantity')
            ->limit(10)
            ->with('product:id,name,name_ka,sku')
            ->get()
            ->map(fn ($item) => [
                'product_id' => $item->product_id,
                'product_name' => $item->product?->name ?? 'Unknown',
                'total_quantity' => (int) $item->total_quantity,
                'total_revenue' => round((float) $item->total_revenue, 2),
            ]);

        $salesByDay = Order::select(
                DB::raw('DATE(ordered_at) as date'),
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(total) as total')
            )
            ->whereBetween('ordered_at', [$dateFrom, $dateTo . ' 23:59:59'])
            ->groupBy(DB::raw('DATE(ordered_at)'))
            ->orderBy('date')
            ->get();

        return $this->sendResponse([
            'total_sales' => round($totalSales, 2),
            'total_orders' => $totalOrders,
            'average_order_value' => round($averageOrderValue, 2),
            'top_products' => $topProducts,
            'sales_by_day' => $salesByDay,
        ], 'Sales report retrieved successfully.');
    }

    public function inventory(): JsonResponse
    {
        $lowStockItems = InventoryItem::with('product:id,name,name_ka,sku')
            ->whereColumn('quantity', '<=', 'min_stock_level')
            ->get();

        $totalStockValue = InventoryItem::join('products', 'inventory_items.product_id', '=', 'products.id')
            ->sum(DB::raw('inventory_items.quantity * products.cost_price'));

        $stockByCategory = InventoryItem::join('products', 'inventory_items.product_id', '=', 'products.id')
            ->join('categories', 'products.category_id', '=', 'categories.id')
            ->select(
                'categories.id as category_id',
                'categories.name as category',
                DB::raw('SUM(inventory_items.quantity) as total_quantity'),
                DB::raw('SUM(inventory_items.quantity * products.cost_price) as value')
            )
            ->groupBy('categories.id', 'categories.name')
            ->get();

        $pendingOrders = Order::where('status', 'pending')->count();
        $activeCustomers = \App\Models\Customer::where('is_active', true)->count();

        return $this->sendResponse([
            'low_stock_items' => $lowStockItems,
            'low_stock_count' => $lowStockItems->count(),
            'total_stock_value' => round($totalStockValue, 2),
            'stock_by_category' => $stockByCategory,
            'pending_orders' => $pendingOrders,
            'active_customers' => $activeCustomers,
        ], 'Inventory report retrieved successfully.');
    }

    public function performance(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $dateFrom = $request->date_from ?? now()->startOfMonth()->toDateString();
        $dateTo = $request->date_to ?? now()->toDateString();

        $salesReps = Order::select(
                'sales_rep_id',
                DB::raw('COUNT(*) as orders_count'),
                DB::raw('SUM(total) as total_sales')
            )
            ->whereBetween('ordered_at', [$dateFrom, $dateTo . ' 23:59:59'])
            ->groupBy('sales_rep_id')
            ->with('salesRep:id,name,email')
            ->get();

        $visits = CustomerVisit::select(
                'user_id',
                DB::raw('COUNT(*) as customers_visited')
            )
            ->whereBetween('visited_at', [$dateFrom, $dateTo . ' 23:59:59'])
            ->groupBy('user_id')
            ->pluck('customers_visited', 'user_id');

        $performance = $salesReps->map(function ($rep) use ($visits) {
            return [
                'sales_rep' => $rep->salesRep,
                'orders_count' => $rep->orders_count,
                'total_sales' => round($rep->total_sales, 2),
                'customers_visited' => $visits[$rep->sales_rep_id] ?? 0,
            ];
        });

        return $this->sendResponse(
            $performance,
            'Performance report retrieved successfully.'
        );
    }
}
