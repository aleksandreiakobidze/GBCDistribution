<?php

namespace App\Http\Middleware;

use App\Erp\Exceptions\ErpException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePresellerMapped
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || $user->id_gvari === null) {
            throw new ErpException(
                'UNMAPPED_PRESELLER',
                'თქვენი ანგარიში არ არის მიბმული პრისელერზე.',
                403,
            );
        }

        $request->attributes->set('idGvari', (int) $user->id_gvari);

        return $next($request);
    }
}
