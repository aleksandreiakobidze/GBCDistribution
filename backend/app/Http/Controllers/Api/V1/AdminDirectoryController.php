<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Erp\Support\RoleMenus;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class AdminDirectoryController extends V1Controller
{
    /** @var list<string> */
    private const BUILTIN_ROLES = ['admin', 'sales_rep', 'supervisor', 'manager', 'warehouse', 'driver'];

    public function users(Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        $users = User::query()
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'id_gvari']);

        return $this->ok($users->map(fn (User $user) => $this->userRow($user))->values());
    }

    public function storeUser(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $this->ensureBuiltinRoles();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'max:255'],
            'role' => ['required', 'string', Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'idGvari' => ['nullable', 'integer', 'min:1'],
        ]);

        $user = User::query()->create([
            'name' => trim($data['name']),
            'email' => trim($data['email']),
            'password' => $data['password'],
            'role' => $data['role'],
            'id_gvari' => $data['idGvari'] ?? null,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
        $user->syncRoles([$data['role']]);

        return $this->ok($this->userRow($user), 201);
    }

    public function updateUser(Request $request, int $id): JsonResponse
    {
        $actor = $this->assertAdmin($request);
        $this->ensureBuiltinRoles();
        $user = User::query()->findOrFail($id);
        $request->merge([
            'name' => trim((string) $request->input('name')),
            'email' => trim((string) $request->input('email')),
        ]);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', 'string', Rule::exists('roles', 'name')->where('guard_name', 'web')],
        ], [
            'name.required' => 'სახელი ცარიელია.',
            'email.required' => 'ლოგინი ცარიელია.',
            'email.unique' => 'ეს ლოგინი უკვე გამოყენებულია.',
        ]);
        $role = $data['role'];
        if ((int) $actor->id === (int) $user->id && $this->roleKey($actor) === UserRole::Admin->value && $role !== UserRole::Admin->value) {
            throw ValidationException::withMessages([
                'role' => 'საკუთარ ადმინის როლს ვერ მოიხსნი.',
            ]);
        }

        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->role = $role;
        $user->save();
        $user->syncRoles([$role]);

        return $this->ok($this->userRow($user));
    }

    public function roles(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $this->ensureBuiltinRoles();

        $names = Role::query()
            ->where('guard_name', 'web')
            ->orderBy('name')
            ->pluck('name')
            ->map(fn ($name) => (string) $name)
            ->values();

        return $this->ok($names);
    }

    public function storeRole(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64', 'regex:/^[\p{L}\p{N}_. -]+$/u'],
        ]);
        $name = trim($data['name']);
        if ($name === '') {
            throw ValidationException::withMessages([
                'name' => 'როლის სახელი ცარიელია.',
            ]);
        }
        Role::query()->firstOrCreate([
            'name' => $name,
            'guard_name' => 'web',
        ]);

        return $this->roles($request);
    }

    public function roleMenus(Request $request, string $role): JsonResponse
    {
        $this->assertAdmin($request);
        $this->ensureBuiltinRoles();
        $name = $this->findRoleName($role);

        return $this->ok(RoleMenus::forRole($name));
    }

    public function updateRoleMenus(Request $request, string $role): JsonResponse
    {
        $this->assertAdmin($request);
        $this->ensureBuiltinRoles();
        $name = $this->findRoleName($role);
        $data = $request->validate([
            'menus' => ['present', 'array'],
            'menus.*' => ['string', Rule::in(RoleMenus::KEYS)],
        ]);

        return $this->ok(RoleMenus::replace($name, $data['menus']));
    }

    private function assertAdmin(Request $request): User
    {
        $user = $this->user($request);
        if ($user->role !== UserRole::Admin) {
            abort(403);
        }

        return $user;
    }

    private function findRoleName(string $role): string
    {
        $name = trim(urldecode($role));
        $found = Role::query()->where('guard_name', 'web')->where('name', $name)->first();
        if ($found === null) {
            abort(404);
        }

        return (string) $found->name;
    }

    private function ensureBuiltinRoles(): void
    {
        foreach (self::BUILTIN_ROLES as $name) {
            Role::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }
    }

    /**
     * @return array{id: int, name: string, email: string, role: string, idGvari: int|null}
     */
    private function userRow(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'name' => (string) $user->name,
            'email' => (string) $user->email,
            'role' => $this->roleKey($user),
            'idGvari' => $user->id_gvari !== null ? (int) $user->id_gvari : null,
        ];
    }

    private function roleKey(User $user): string
    {
        $role = $user->role;

        return $role instanceof UserRole ? $role->value : (string) $role;
    }
}
