<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Erp\Support\TeamAccess;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamRepController extends V1Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $query = User::query()
            ->where('role', UserRole::SalesRep)
            ->whereNotNull('id_gvari')
            ->where('is_active', true)
            ->orderBy('name');

        if (TeamAccess::isTeamLead($user)) {
            $ids = TeamAccess::salesUserIds($user) ?? [];
            $query->whereIn('id', $ids === [] ? [-1] : $ids);
        } elseif (TeamAccess::role($user) !== UserRole::Admin) {
            return $this->ok([]);
        }

        $items = $query->get(['id', 'name', 'id_gvari'])->map(fn (User $rep) => [
            'id' => $rep->id,
            'name' => $rep->name,
            'presellerId' => (string) $rep->id_gvari,
        ])->values();

        return $this->ok($items);
    }
}
