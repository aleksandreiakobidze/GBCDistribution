<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// SPA catch-all (serves the React app for any non-API, non-admin route)
Route::get('/app/{any?}', function () {
    $path = public_path('app/index.html');
    if (file_exists($path)) {
        return response()->file($path);
    }
    return response('Frontend not built yet. Run "npm run build" in the frontend directory.', 404);
})->where('any', '.*');
