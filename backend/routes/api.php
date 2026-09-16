<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\CustomerVisitController;
use App\Http\Controllers\Api\DeliveryController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReturnController;
use App\Http\Controllers\Api\SyncController;
use App\Http\Controllers\Api\V1\CustomerController as V1CustomerController;
use App\Http\Controllers\Api\V1\HealthController as V1HealthController;
use App\Http\Controllers\Api\V1\ItemController as V1ItemController;
use App\Http\Controllers\Api\V1\MeController as V1MeController;
use App\Http\Controllers\Api\V1\OrderController as V1OrderController;
use App\Http\Controllers\Api\V1\PromotionController as V1PromotionController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/user', [AuthController::class, 'user']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{id}', [ProductController::class, 'show']);

    Route::get('/categories', [CategoryController::class, 'index']);

    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::get('/customers/{id}', [CustomerController::class, 'show']);
    Route::put('/customers/{id}', [CustomerController::class, 'update']);

    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::patch('/orders/{id}/status', [OrderController::class, 'updateStatus']);

    Route::get('/deliveries', [DeliveryController::class, 'index']);
    Route::get('/deliveries/{id}', [DeliveryController::class, 'show']);
    Route::patch('/deliveries/{id}/status', [DeliveryController::class, 'updateStatus']);
    Route::post('/deliveries/{id}/pod', [DeliveryController::class, 'uploadPod']);

    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::get('/invoices/{id}', [InvoiceController::class, 'show']);
    Route::post('/invoices/{id}/payment', [InvoiceController::class, 'recordPayment']);

    Route::get('/returns', [ReturnController::class, 'index']);
    Route::post('/returns', [ReturnController::class, 'store']);
    Route::patch('/returns/{id}/status', [ReturnController::class, 'updateStatus']);

    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::post('/inventory/adjust', [InventoryController::class, 'adjust']);
    Route::get('/inventory/movements', [InventoryController::class, 'movements']);

    Route::get('/reports/sales', [ReportController::class, 'sales']);
    Route::get('/reports/inventory', [ReportController::class, 'inventory']);
    Route::get('/reports/performance', [ReportController::class, 'performance']);

    Route::post('/sync/orders', [SyncController::class, 'pushOrders']);
    Route::get('/sync/pull', [SyncController::class, 'pull']);

    Route::post('/customer-visits', [CustomerVisitController::class, 'store']);
});

Route::prefix('v1')->group(function () {
    Route::get('/health', [V1HealthController::class, 'invoke'])->name('v1.health');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', V1MeController::class);
        Route::get('/health/diagnostics', [V1HealthController::class, 'diagnostics']);

        Route::middleware('preseller')->group(function () {
            Route::get('/customers', [V1CustomerController::class, 'index']);
            Route::get('/customers/{customerId}', [V1CustomerController::class, 'show']);
            Route::get('/items', [V1ItemController::class, 'index']);
            Route::get('/items/{itemId}', [V1ItemController::class, 'show']);
            Route::get('/promotions', [V1PromotionController::class, 'index']);
            Route::post('/orders/quote', [V1OrderController::class, 'quote']);
            Route::post('/orders', [V1OrderController::class, 'store']);
            Route::get('/orders/{erpOrderId}/status', [V1OrderController::class, 'status']);
        });
    });
});
