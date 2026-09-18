<?php

namespace Database\Seeders;

use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

class InventorySeeder extends Seeder
{
    public function run(): void
    {
        $mainWarehouse = Warehouse::where('is_default', true)->first();
        $secondaryWarehouse = Warehouse::where('is_default', false)->first();
        $allProducts = Product::all();

        foreach ($allProducts as $product) {
            InventoryItem::create([
                'warehouse_id'    => $mainWarehouse->id,
                'product_id'      => $product->id,
                'quantity'        => rand(50, 500),
                'reserved_quantity' => 0,
                'min_stock_level' => rand(10, 50),
            ]);
        }

        $secondaryProducts = $allProducts->random(30);

        foreach ($secondaryProducts as $product) {
            InventoryItem::create([
                'warehouse_id'    => $secondaryWarehouse->id,
                'product_id'      => $product->id,
                'quantity'        => rand(20, 200),
                'reserved_quantity' => 0,
                'min_stock_level' => rand(10, 30),
            ]);
        }
    }
}
