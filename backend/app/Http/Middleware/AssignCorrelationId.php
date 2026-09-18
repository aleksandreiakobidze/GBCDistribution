<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Str;

class AssignCorrelationId
{
    public function handle(Request $request, Closure $next): Response
    {
        $id = $request->header('X-Correlation-Id') ?: (string) Str::uuid();
        $request->attributes->set('correlationId', $id);

        /** @var Response $response */
        $response = $next($request);
        $response->headers->set('X-Correlation-Id', $id);

        return $response;
    }
}
