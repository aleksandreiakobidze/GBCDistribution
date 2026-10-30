import { useEffect, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared';
import { Button, Card, Input, Select, Spinner, Switch } from '@/components/ui';
import { erpApi } from '@/lib/api/erp.api';
import { menuCatalog } from '@/lib/menu';
import { useAuthStore } from '@/stores/authStore';
import type { FieldRules, User } from '@/types';

const keys = [
  'requirePhotoBefore',
  'requirePhotoEnd',
  'requirePhotoShelf',
  'requireSurvey',
  'requireShelfAudit',
  'requireGps',
  'missedSkipsRules',
] as const;

function apiMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
  }
  return null;
}

const knownRoles = ['admin', 'sales_rep', 'supervisor', 'manager', 'warehouse', 'driver'] as const;

function roleLabel(name: string, t: (key: string, fallback: string) => string): string {
  return t(`roles.${name}`, name);
}

function knownRole(value: string): User['role'] | null {
  return (knownRoles as readonly string[]).includes(value) ? (value as User['role']) : null;
}

export default function FieldSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.user?.role);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState('');
  const [idGvari, setIdGvari] = useState('');
  const [roleName, setRoleName] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [userError, setUserError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [menuChecks, setMenuChecks] = useState<string[]>([]);

  const settingsQuery = useQuery({
    queryKey: ['field-settings'],
    queryFn: () => erpApi.fieldSettings(),
    enabled: role === 'admin',
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => erpApi.adminUsers(),
    enabled: role === 'admin',
  });
  const rolesQuery = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => erpApi.adminRoles(),
    enabled: role === 'admin',
  });
  const menuQuery = useQuery({
    queryKey: ['admin-role-menus', selectedRole],
    queryFn: () => erpApi.adminRoleMenus(selectedRole as string),
    enabled: role === 'admin' && selectedRole !== null,
  });
  const save = useMutation({
    mutationFn: (rules: FieldRules) => erpApi.updateFieldSettings(rules),
    onSuccess: async (rules) => {
      queryClient.setQueryData(['field-settings'], rules);
      await queryClient.invalidateQueries({ queryKey: ['erp-me'] });
    },
  });
  const createUser = useMutation({
    mutationFn: () => erpApi.createAdminUser({
      name: name.trim(),
      email: email.trim(),
      password,
      role: userRole,
      idGvari: idGvari.trim() === '' ? null : Number(idGvari),
    }),
    onSuccess: async () => {
      setName('');
      setEmail('');
      setPassword('');
      setUserRole('');
      setIdGvari('');
      setUserError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => setUserError(apiMessage(error)),
  });
  const updatePerson = useMutation({
    mutationFn: (body: { id: number; name: string; email: string; role: string }) => erpApi.updateAdminUser(body.id, {
      name: body.name,
      email: body.email,
      role: body.role,
    }),
    onSuccess: async (row) => {
      setUserError(null);
      setEditingId(null);
      const current = useAuthStore.getState().user;
      if (current && current.id === row.id) {
        const nextRole = knownRole(row.role);
        useAuthStore.getState().updateUser({
          ...current,
          name: row.name,
          email: row.email,
          ...(nextRole ? { role: nextRole } : {}),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => setUserError(apiMessage(error)),
  });
  const createRole = useMutation({
    mutationFn: () => erpApi.createAdminRole(roleName.trim()),
    onSuccess: async (roles) => {
      setRoleName('');
      setRoleError(null);
      queryClient.setQueryData(['admin-roles'], roles);
    },
    onError: (error) => setRoleError(apiMessage(error)),
  });
  const saveMenus = useMutation({
    mutationFn: () => erpApi.updateAdminRoleMenus(selectedRole as string, menuChecks),
    onSuccess: (menus) => {
      setMenuChecks(menus);
      setRoleError(null);
      queryClient.setQueryData(['admin-role-menus', selectedRole], menus);
      const current = useAuthStore.getState().user;
      if (current && current.role === selectedRole) {
        useAuthStore.getState().updateUser({ ...current, menus });
      }
    },
    onError: (error) => setRoleError(apiMessage(error)),
  });

  useEffect(() => {
    if (menuQuery.data) {
      setMenuChecks(menuQuery.data);
    }
  }, [menuQuery.data]);

  function beginEdit(person: { id: number; name: string; email: string; role: string }) {
    setEditingId(person.id);
    setEditName(person.name);
    setEditEmail(person.email);
    setEditRole(person.role);
    setUserError(null);
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const rules = settingsQuery.data;
  const roleOptions = (rolesQuery.data ?? []).map((item) => ({
    value: item,
    label: roleLabel(item, t),
  }));
  const needle = search.trim().toLowerCase();
  const people = (usersQuery.data ?? []).filter((person) => (
    needle === ''
    || person.name.toLowerCase().includes(needle)
    || person.email.toLowerCase().includes(needle)
  ));
  const fieldClass = 'h-9';

  return (
    <div className="space-y-3">
      <PageHeader
        title={t('fieldSettings.title', 'Settings')}
        subtitle={t('fieldSettings.subtitle', 'Rules a preseller must finish before closing a visit')}
      />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          {settingsQuery.isLoading || !rules ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {keys.map((key) => (
                <Switch
                  key={key}
                  checked={rules[key]}
                  disabled={save.isPending}
                  label={t(`fieldSettings.${key}`)}
                  onCheckedChange={(checked) => save.mutate({ ...rules, [key]: checked })}
                />
              ))}
            </div>
          )}
          {save.isSuccess ? (
            <p className="text-xs font-medium text-[var(--color-success)]">{t('fieldSettings.saved', 'Saved')}</p>
          ) : null}
        </Card>

        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('fieldSettings.rolesTitle', 'Roles')}</h2>
          {rolesQuery.isLoading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {(rolesQuery.data ?? []).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${selectedRole === item ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-hover)] text-[var(--color-text)]'}`}
                  onClick={() => setSelectedRole(item)}
                >
                  {roleLabel(item, t)}
                </button>
              ))}
              <Input
                value={roleName}
                placeholder={t('fieldSettings.roleName', 'Role name')}
                className="h-8 w-36"
                onChange={(event) => setRoleName(event.target.value)}
              />
              <Button size="sm" className="h-8" disabled={createRole.isPending || roleName.trim() === ''} onClick={() => createRole.mutate()}>
                {t('fieldSettings.createRole', 'New role')}
              </Button>
            </div>
          )}
          {roleError ? <p className="text-xs font-medium text-[var(--color-danger)]">{roleError}</p> : null}
          {createRole.isSuccess && !saveMenus.isSuccess ? (
            <p className="text-xs font-medium text-[var(--color-success)]">{t('fieldSettings.saved', 'Saved')}</p>
          ) : null}
          {selectedRole ? (
            <div className="space-y-2 border-t border-[var(--color-border)] pt-2">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">{t('fieldSettings.menus', 'Menu')}</p>
              {menuQuery.isLoading ? (
                <div className="flex justify-center py-3"><Spinner /></div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {menuCatalog.map((item) => {
                    const locked = selectedRole === 'admin' && item.key === 'settings';
                    return (
                      <label key={item.key} className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--color-primary)]"
                          checked={locked || menuChecks.includes(item.key)}
                          disabled={locked || saveMenus.isPending}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setMenuChecks((current) => (
                              checked ? [...current, item.key] : current.filter((key) => key !== item.key)
                            ));
                          }}
                        />
                        <span className="truncate">{t(item.label)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <Button size="sm" className="h-8" disabled={saveMenus.isPending || menuQuery.isLoading} onClick={() => saveMenus.mutate()}>
                {t('common.save', 'Save')}
              </Button>
              {saveMenus.isSuccess ? (
                <p className="text-xs font-medium text-[var(--color-success)]">{t('fieldSettings.saved', 'Saved')}</p>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('fieldSettings.usersTitle', 'Users')}</h2>
          <Input
            value={search}
            placeholder={t('filters.search', 'Search')}
            className={`${fieldClass} w-44`}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={name} placeholder={t('fieldSettings.userName', 'Name')} className={`${fieldClass} w-36`} onChange={(event) => setName(event.target.value)} />
          <Input value={email} placeholder={t('fieldSettings.login', 'Login')} className={`${fieldClass} w-40`} onChange={(event) => setEmail(event.target.value)} />
          <Input value={password} type="password" placeholder={t('fieldSettings.password', 'Password')} className={`${fieldClass} w-32`} onChange={(event) => setPassword(event.target.value)} />
          <div className="w-36">
            <Select
              options={roleOptions}
              value={userRole || undefined}
              placeholder={t('fieldSettings.role', 'Role')}
              className={fieldClass}
              onChange={setUserRole}
            />
          </div>
          <Input
            value={idGvari}
            inputMode="numeric"
            placeholder={t('fieldSettings.idGvari', 'IdGvari')}
            title={t('fieldSettings.idGvariHint')}
            className={`${fieldClass} w-28`}
            onChange={(event) => setIdGvari(event.target.value)}
          />
          <Button
            size="sm"
            className={fieldClass}
            disabled={createUser.isPending || name.trim() === '' || email.trim() === '' || password === '' || userRole === ''}
            onClick={() => createUser.mutate()}
          >
            {t('fieldSettings.createUser', 'New user')}
          </Button>
        </div>
        {userError ? <p className="text-xs font-medium text-[var(--color-danger)]">{userError}</p> : null}
        {createUser.isSuccess || updatePerson.isSuccess ? (
          <p className="text-xs font-medium text-[var(--color-success)]">{t('fieldSettings.saved', 'Saved')}</p>
        ) : null}
        {usersQuery.isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {people.map((person) => (
              editingId === person.id ? (
                <div key={person.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <Input
                    value={editName}
                    placeholder={t('fieldSettings.userName', 'Name')}
                    className="h-8 w-36"
                    onChange={(event) => setEditName(event.target.value)}
                  />
                  <Input
                    value={editEmail}
                    placeholder={t('fieldSettings.login', 'Login')}
                    className="h-8 w-40"
                    onChange={(event) => setEditEmail(event.target.value)}
                  />
                  <div className="w-36">
                    <Select
                      options={roleOptions}
                      value={editRole || undefined}
                      placeholder={t('fieldSettings.role', 'Role')}
                      className="h-8"
                      disabled={person.id === userId && person.role === 'admin'}
                      onChange={setEditRole}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={updatePerson.isPending || editName.trim() === '' || editEmail.trim() === '' || editRole === ''}
                    onClick={() => updatePerson.mutate({
                      id: person.id,
                      name: editName.trim(),
                      email: editEmail.trim(),
                      role: editRole,
                    })}
                  >
                    {t('common.save', 'Save')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                </div>
              ) : (
                <div key={person.id} className="flex items-center gap-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-text)]">{person.name}</p>
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">{person.email}</p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">{roleLabel(person.role, t)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 px-0"
                    aria-label={t('common.edit', 'Edit')}
                    onClick={() => beginEdit(person)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
