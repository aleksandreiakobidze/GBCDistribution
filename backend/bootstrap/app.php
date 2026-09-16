<?php

use App\Erp\Exceptions\ErpException;
use App\Http\Middleware\AssignCorrelationId;
use App\Http\Middleware\EnsurePresellerMapped;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->append(AssignCorrelationId::class);
        $middleware->alias([
            'preseller' => EnsurePresellerMapped::class,
        ]);

        $trusted = env('TRUSTED_PROXIES');
        if (is_string($trusted) && $trusted !== '') {
            $middleware->trustProxies(at: $trusted === '*' ? '*' : array_map('trim', explode(',', $trusted)));
        }
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ErpException $e, Request $request) {
            if ($request->is('api/*')) {
                $payload = [
                    'success' => false,
                    'code' => $e->errorCode,
                    'message' => $e->getMessage(),
                    'correlationId' => $request->attributes->get('correlationId'),
                ];
                if ($e->details !== []) {
                    $payload['details'] = $e->details;
                }

                return response()->json($payload, $e->httpStatus);
            }
        });
    })->create();
