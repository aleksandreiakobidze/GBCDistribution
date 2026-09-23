<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Erp\Exceptions\ErpException;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePresellerMapped
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            throw new ErpException(
                'UNMAPPED_PRESELLER',
                'თქვენი ანგარიში არ არის მიბმული პრისელერზე.',
                403,
            );
        }

        $role = $user->role instanceof UserRole ? $user->role : UserRole::from((string) $user->role);
        $salesUserId = $request->query('salesUserId');

        if ($role === UserRole::Supervisor) {
            $target = $this->ownTeamSalesRep($user, $salesUserId);
            $request->attributes->set('idGvari', (int) $target->id_gvari);
            $request->attributes->set('presellerUserId', (int) $target->id);

            return $next($request);
        }

        if ($role === UserRole::Admin && $salesUserId) {
            $target = User::query()
                ->whereKey($salesUserId)
                ->where('role', UserRole::SalesRep)
                ->first();
            if (! $target || $target->id_gvari === null) {
                throw new ErpException(
                    'FORBIDDEN_PRESELLER',
                    'ამ სეილს რეპის მარშრუტი არ არის ხელმისაწვდომი.',
                    403,
                );
            }
            $request->attributes->set('idGvari', (int) $target->id_gvari);
            $request->attributes->set('presellerUserId', (int) $target->id);

            return $next($request);
        }

        if ($user->id_gvari === null) {
            throw new ErpException(
                'UNMAPPED_PRESELLER',
                'თქვენი ანგარიში არ არის მიბმული პრისელერზე.',
                403,
            );
        }

        $request->attributes->set('idGvari', (int) $user->id_gvari);
        $request->attributes->set('presellerUserId', (int) $user->id);

        return $next($request);
    }

    private function ownTeamSalesRep(User $supervisor, mixed $salesUserId): User
    {
        if ($salesUserId === null || $salesUserId === '') {
            throw new ErpException(
                'SALES_USER_REQUIRED',
                'აირჩიეთ სეილს რეპი.',
                400,
            );
        }

        $target = User::query()->whereKey($salesUserId)->first();
        if (
            ! $target
            || $target->role !== UserRole::SalesRep
            || (int) $target->supervisor_id !== (int) $supervisor->id
            || $target->id_gvari === null
        ) {
            throw new ErpException(
                'FORBIDDEN_PRESELLER',
                'ამ სეილს რეპის მარშრუტი არ გეკუთვნით.',
                403,
            );
        }

        return $target;
    }
}
