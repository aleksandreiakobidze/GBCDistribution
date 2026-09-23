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
use App\Http\Controllers\Api\V1\TeamRepController as V1TeamRepController;
use App\Http\Controllers\Api\V1\OrderController as V1OrderController;
use App\Http\Controllers\Api\V1\CollectionController as V1CollectionController;
use App\Http\Controllers\Api\V1\VisitController as V1VisitController;
use App\Http\Controllers\Api\V1\VisitPhotoController as V1VisitPhotoController;
use App\Http\Controllers\Api\V1\GalleryPhotoController as V1GalleryPhotoController;
use App\Http\Controllers\Api\V1\FieldWorkController as V1FieldWorkController;
use App\Http\Controllers\Api\V1\ProductReturnController as V1ProductReturnController;
use App\Http\Controllers\Api\V1\SavedOrderController as V1SavedOrderController;
use App\Http\Controllers\Api\V1\PromotionController as V1PromotionController;
use App\Http\Controllers\Api\V1\PriceListController as V1PriceListController;
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
    Route::patch('/orders/{id}', [OrderController::class, 'update']);
    Route::patch('/orders/{id}/status', [OrderController::class, 'updateStatus']);

    Route::get('/deliveries', [DeliveryController::class, 'index']);
    Route::get('/deliveries/{id}', [DeliveryController::class, 'show']);
    Route::patch('/deliveries/{id}/status', [DeliveryController::class, 'updateStatus']);
    Route::post('/deliveries/{id}/pod', [DeliveryController::class, 'uploadPod']);

    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::get('/invoices/{id}', [InvoiceController::class, 'show']);
    Route::patch('/invoices/{id}', [InvoiceController::class, 'update']);
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
        Route::get('/team-reps', V1TeamRepController::class);
        Route::get('/gallery/photos', [V1GalleryPhotoController::class, 'index']);
        Route::post('/gallery/photos/download', [V1GalleryPhotoController::class, 'download']);
        Route::patch('/gallery/photos/{id}', [V1GalleryPhotoController::class, 'update']);
        Route::get('/gallery/photos/{id}/file', [V1GalleryPhotoController::class, 'file']);
        Route::get('/tasks', [V1FieldWorkController::class, 'tasks']);
        Route::post('/tasks', [V1FieldWorkController::class, 'storeTask']);
        Route::patch('/tasks/{id}', [V1FieldWorkController::class, 'updateTask']);
        Route::get('/visit-surveys', [V1FieldWorkController::class, 'surveys']);
        Route::post('/visit-surveys', [V1FieldWorkController::class, 'storeSurvey']);
        Route::get('/visit-coaching', [V1FieldWorkController::class, 'coaching']);
        Route::post('/visit-coaching', [V1FieldWorkController::class, 'storeCoaching']);
        Route::get('/shelf-audits', [V1FieldWorkController::class, 'shelf']);
        Route::post('/shelf-audits', [V1FieldWorkController::class, 'storeShelf']);
        Route::get('/promo-plans', [V1FieldWorkController::class, 'promos']);
        Route::post('/promo-plans', [V1FieldWorkController::class, 'storePromo']);
        Route::patch('/promo-plans/{id}', [V1FieldWorkController::class, 'updatePromo']);
        Route::post('/promo-plans/{id}/copy', [V1FieldWorkController::class, 'copyPromo']);
        Route::get('/day', [V1FieldWorkController::class, 'day']);
        Route::get('/dashboard', [V1FieldWorkController::class, 'dashboard']);
        Route::get('/my-reports', [V1FieldWorkController::class, 'myReports']);
        Route::get('/health/diagnostics', [V1HealthController::class, 'diagnostics']);
        Route::get('/price-list', [V1PriceListController::class, 'meta']);
        Route::get('/price-list/file', [V1PriceListController::class, 'file']);

        Route::middleware('preseller')->group(function () {
            Route::get('/customers', [V1CustomerController::class, 'index']);
            Route::get('/customers/{customerId}', [V1CustomerController::class, 'show']);
            Route::get('/items', [V1ItemController::class, 'index']);
            Route::get('/items/groups', [V1ItemController::class, 'groups']);
            Route::get('/items/taxonomy', [V1ItemController::class, 'taxonomy']);
            Route::get('/items/{itemId}', [V1ItemController::class, 'show']);
            Route::get('/promotions', [V1PromotionController::class, 'index']);
            Route::get('/orders', [V1OrderController::class, 'index']);
            Route::post('/orders/quote', [V1OrderController::class, 'quote']);
            Route::post('/orders', [V1OrderController::class, 'store']);
            Route::get('/orders/{erpOrderId}/status', [V1OrderController::class, 'status']);
            Route::get('/saved-orders', [V1SavedOrderController::class, 'index']);
            Route::post('/saved-orders', [V1SavedOrderController::class, 'store']);
            Route::get('/saved-orders/{id}', [V1SavedOrderController::class, 'show']);
            Route::patch('/saved-orders/{id}', [V1SavedOrderController::class, 'update']);
            Route::get('/visits', [V1VisitController::class, 'index']);
            Route::post('/visits', [V1VisitController::class, 'store']);
            Route::patch('/visits/{id}', [V1VisitController::class, 'update']);
            Route::get('/visit-photos', [V1VisitPhotoController::class, 'index']);
            Route::post('/visit-photos', [V1VisitPhotoController::class, 'store']);
            Route::get('/visit-photos/{id}/file', [V1VisitPhotoController::class, 'file']);
            Route::get('/collections', [V1CollectionController::class, 'index']);
            Route::post('/collections', [V1CollectionController::class, 'store']);
            Route::get('/collections/{id}', [V1CollectionController::class, 'show']);
            Route::patch('/collections/{id}', [V1CollectionController::class, 'update']);
            Route::get('/product-returns', [V1ProductReturnController::class, 'index']);
            Route::post('/product-returns', [V1ProductReturnController::class, 'store']);
            Route::get('/product-returns/{id}', [V1ProductReturnController::class, 'show']);
            Route::patch('/product-returns/{id}', [V1ProductReturnController::class, 'update']);
        });
    });
});
