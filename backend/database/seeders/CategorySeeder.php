<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Beverages',     'name_ka' => 'სასმელები',              'sort_order' => 1],
            ['name' => 'Dairy',         'name_ka' => 'რძის პროდუქტები',        'sort_order' => 2],
            ['name' => 'Snacks',        'name_ka' => 'საჭმელები',              'sort_order' => 3],
            ['name' => 'Bakery',        'name_ka' => 'საცხობი',                'sort_order' => 4],
            ['name' => 'Canned Goods',  'name_ka' => 'კონსერვები',             'sort_order' => 5],
            ['name' => 'Cleaning',      'name_ka' => 'საწმენდი საშუალებები',    'sort_order' => 6],
            ['name' => 'Personal Care', 'name_ka' => 'პირადი მოვლა',           'sort_order' => 7],
            ['name' => 'Frozen',        'name_ka' => 'გაყინული პროდუქტები',    'sort_order' => 8],
        ];

        foreach ($categories as $category) {
            Category::create(array_merge($category, [
                'slug' => Str::slug($category['name']),
            ]));
        }
    }
}
