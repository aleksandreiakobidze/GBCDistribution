<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;

class CategoryController extends BaseController
{
    public function index(): JsonResponse
    {
        $categories = Category::withCount('products')
            ->orderBy('sort_order')
            ->get();

        return $this->sendResponse(
            CategoryResource::collection($categories),
            'Categories retrieved successfully.'
        );
    }
}
