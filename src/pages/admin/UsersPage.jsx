import { useEffect, useMemo, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { format } from 'date-fns';
import { useDateLocale, datePattern } from '../../hooks/useDateLocale';
import { listUsers, createUser, updateUser, deleteUser, resendAccess } from '../../api/users';
import D365Combobox from '../../components/D365Combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, Pencil, Link, UserCheck, UserX, Trash2, Send, KeyRound, ShieldCheck, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL_KEY   = { admin: 'usersPage.roleAdmin', support: 'usersPage.roleSupport', consultor: 'usersPage.roleConsultor', client: 'usersPage.roleClient' };
const ROLE_VARIANT = { admin: 'default', support: 'outline', consultor: 'outline', client: 'secondary' };
const LANGUAGE_LABEL_KEY = { es: 'usersPage.languageSpanish', en: 'usersPage.languageEnglish' };

const initials = (name) =>
  (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

const shortGuid = (guid) => (guid ? `${guid.slice(0, 8)}…` : null);

// ─── Esquemas de validación ───────────────────────────────────────────────────
// Los mensajes de zod se resuelven una sola vez al montar el módulo (no
// dependen del idioma en curso) — quedan en español, igual que el resto de
// mensajes de validación de formularios "internos" de administración.

const guidOrEmpty = z
  .string()
  .optional()
  .refine((v) => !v || /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v), {
    message: 'Debe ser un GUID válido (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
  });

const passwordRules = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
  .regex(/[0-9]/, 'Debe tener al menos un número');

// Correo de acceso (2026-11-23): para un cliente con la casilla marcada, la
// contraseña la genera el backend y se le envía por correo — aquí no se pide.
const createSchema = z.object({
  email:          z.string().email('Email inválido'),
  fullName:       z.string().min(1, 'Nombre requerido'),
  password:       z.string().optional(),
  sendAccessEmail: z.boolean(),
  // Verificación en dos pasos por correo (2026-11-24), cualquier rol.
  mfaEnabled:     z.boolean(),
  role:           z.enum(['admin', 'support', 'consultor', 'client']),
  language:       z.enum(['es', 'en']),
  // Empresa (multi-empresa, 2026-10-07): solo se guarda para staff; la de un
  // cliente sale de su cuenta en Dynamics.
  company:        z.enum(['grupostaff', 'satustec']),
  d365ContactId:  guidOrEmpty,
  d365AccountId:  guidOrEmpty,
}).superRefine((d, ctx) => {
  if (d.role === 'client' && d.sendAccessEmail) return;
  const r = passwordRules.safeParse(d.password ?? '');
  if (!r.success) ctx.addIssue({ code: 'custom', path: ['password'], message: r.error.issues[0].message });
});

const CREATE_DEFAULTS = { email: '', fullName: '', password: '', sendAccessEmail: true, mfaEnabled: false, role: 'client', language: 'es', company: 'grupostaff', d365ContactId: '', d365AccountId: '' };

const editSchema = z.object({
  fullName:       z.string().min(1, 'Nombre requerido'),
  role:           z.enum(['admin', 'support', 'consultor', 'client']),
  language:       z.enum(['es', 'en']),
  // Empresa (multi-empresa, 2026-10-07): solo se guarda para staff; la de un
  // cliente sale de su cuenta en Dynamics.
  company:        z.enum(['grupostaff', 'satustec']),
  isActive:       z.boolean(),
  mfaEnabled:     z.boolean(),
  d365ContactId:  guidOrEmpty,
  d365AccountId:  guidOrEmpty,
  password:       z.union([passwordRules, z.literal('')]).optional(),
});

// ─── Modal de creación / edición ──────────────────────────────────────────────

const UserFormModal = ({ user, open, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const isEdit   = !!user;
  const schema   = isEdit ? editSchema : createSchema;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(schema),
      defaultValues: isEdit
        ? {
            fullName:      user.fullName || '',
            role:          user.role || 'client',
            language:      user.language || 'es',
            company:       user.company || 'grupostaff',
            isActive:      user.isActive ?? true,
            mfaEnabled:    !!user.mfaEnabled,
            d365ContactId: user.d365ContactId || '',
            d365AccountId: user.d365AccountId || '',
            password:      '',
          }
        : CREATE_DEFAULTS,
    });

  // Sincronizar defaults cuando cambia el usuario seleccionado
  useEffect(() => {
    if (open) {
      reset(
        isEdit
          ? {
              fullName:      user.fullName || '',
              role:          user.role || 'client',
              language:      user.language || 'es',
              company:       user.company || 'grupostaff',
              isActive:      user.isActive ?? true,
              mfaEnabled:    !!user.mfaEnabled,
              d365ContactId: user.d365ContactId || '',
              d365AccountId: user.d365AccountId || '',
              password:      '',
            }
          : CREATE_DEFAULTS
      );
    }
  }, [open, user]);

  const isActive = watch('isActive');
  const mfaEnabled = watch('mfaEnabled');
  const role = watch('role');
  const sendAccessEmail = watch('sendAccessEmail');
  // Cliente nuevo con correo de acceso: la contraseña la genera el backend.
  const autoPassword = !isEdit && role === 'client' && sendAccessEmail;

  const onSubmit = async (data) => {
    try {
      const payload = { ...data };
      // null = borrar vínculo; undefined (ausente) = no tocar
      payload.d365ContactId = payload.d365ContactId || null;
      payload.d365AccountId = payload.d365AccountId || null;
      if (isEdit && !payload.password) delete payload.password;
      // La empresa de un cliente sale de su cuenta: no se manda (el backend la ignora igual).
      if (payload.role === 'client') delete payload.company;
      // Correo de acceso: solo clientes nuevos; con él no se manda contraseña.
      if (!isEdit) {
        payload.sendAccessEmail = payload.role === 'client' && !!payload.sendAccessEmail;
        if (payload.sendAccessEmail) delete payload.password;
      }

      if (isEdit) {
        await updateUser(user.id, payload);
        toast.success(t('usersPage.updatedToast'));
      } else {
        const created = await createUser(payload);
        if (created.accessEmail === 'queued') toast.success(t('usersPage.accessEmailQueued', { email: created.email }));
        else if (created.accessEmail === 'failed') toast.warning(t('usersPage.accessEmailFailed'), { duration: 10000 });
        else toast.success(t('usersPage.createdToast'));
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('usersPage.saveError'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* 2026-11-24: ventana ancha a dos columnas para que quepan todos los
          campos sin desplazarse; en pantallas chicas vuelve a una columna y,
          si aun así no cabe, se desplaza dentro de la ventana (nunca se corta). */}
      <DialogContent className="sm:max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('usersPage.editTitle', { name: user.fullName }) : t('usersPage.newUserTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
          {/* Email (solo en creación) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('usersPage.emailLabel')}</Label>
              <Input id="email" type="email" placeholder="usuario@empresa.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          )}

          {/* Nombre completo */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">{t('usersPage.fullNameLabel')}</Label>
            <Input id="fullName" placeholder={t('usersPage.fullNamePlaceholder')} {...register('fullName')} />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
          </div>

          {/* Rol */}
          <div className="space-y-1.5">
            <Label>{t('usersPage.roleLabel')}</Label>
            <Select
              defaultValue={isEdit ? user.role : 'client'}
              onValueChange={(v) => setValue('role', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">{t('usersPage.roleClient')}</SelectItem>
                <SelectItem value="support">{t('usersPage.roleSupport')}</SelectItem>
                <SelectItem value="consultor">{t('usersPage.roleConsultor')}</SelectItem>
                <SelectItem value="admin">{t('usersPage.roleAdmin')}</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          {/* Idioma */}
          <div className="space-y-1.5">
            <Label>{t('usersPage.languageLabel')}</Label>
            <Select
              defaultValue={isEdit ? (user.language || 'es') : 'es'}
              onValueChange={(v) => setValue('language', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">{t('usersPage.languageSpanish')}</SelectItem>
                <SelectItem value="en">{t('usersPage.languageEnglish')}</SelectItem>
              </SelectContent>
            </Select>
            {errors.language && <p className="text-xs text-destructive">{errors.language.message}</p>}
          </div>

          {/* Empresa — solo staff; para clientes sale de su cuenta en Dynamics */}
          <div className="space-y-1.5">
            <Label>{t('usersPage.companyLabel')}</Label>
            {role === 'client' ? (
              <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 px-3 py-2">{t('usersPage.companyClientHint')}</p>
            ) : (
              <Select
                key={isEdit ? user.id : 'new'}
                defaultValue={isEdit ? (user.company || 'grupostaff') : 'grupostaff'}
                onValueChange={(v) => setValue('company', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grupostaff">Grupo Staff</SelectItem>
                  <SelectItem value="satustec">Satustec</SelectItem>
                </SelectContent>
              </Select>
            )}
            {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
          </div>

          {/* Estado activo (solo en edición) */}
          {isEdit && (
            <div className="flex items-center gap-3 sm:pt-6">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(v) => setValue('isActive', v)}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                {isActive ? t('usersPage.userActive') : t('usersPage.userInactive')}
              </Label>
            </div>
          )}
          </div>

          {/* Separador de sección D365 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Link className="h-3 w-3" />
              {t('usersPage.d365Linking')}
            </p>

            <div className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {t('usersPage.companyAccount')}
                </Label>
                <D365Combobox
                  entityType="account"
                  value={watch('d365AccountId') || ''}
                  onChange={(id) => {
                    setValue('d365AccountId', id, { shouldValidate: true });
                    // El contacto elegido antes puede no pertenecer a la
                    // empresa nueva — se limpia para no dejar una
                    // combinación inconsistente.
                    setValue('d365ContactId', '', { shouldValidate: true });
                  }}
                />
                {errors.d365AccountId && (
                  <p className="text-xs text-destructive">{errors.d365AccountId.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">
                  {t('table.contact')}
                  <span className="text-muted-foreground font-normal ml-1">{t('usersPage.contactHint')}</span>
                </Label>
                <D365Combobox
                  entityType="contact"
                  value={watch('d365ContactId') || ''}
                  onChange={(id) => setValue('d365ContactId', id, { shouldValidate: true })}
                  filterAccountId={watch('d365AccountId') || ''}
                  disabled={!watch('d365AccountId')}
                />
                {!watch('d365AccountId') && (
                  <p className="text-xs text-muted-foreground">{t('usersPage.selectCompanyFirst')}</p>
                )}
                {errors.d365ContactId && (
                  <p className="text-xs text-destructive">{errors.d365ContactId.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Verificación en dos pasos por correo (2026-11-24) — cualquier rol, apagada por default */}
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <Switch
              id="mfaEnabled"
              checked={!!mfaEnabled}
              onCheckedChange={(v) => setValue('mfaEnabled', v)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="mfaEnabled" className="cursor-pointer">{t('usersPage.mfaEnabled')}</Label>
              <p className="text-xs text-muted-foreground">{t('usersPage.mfaEnabledHint')}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 items-start empty:hidden">
          {/* Correo de acceso (2026-11-23) — solo clientes nuevos, marcado por default */}
          {!isEdit && role === 'client' && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Switch
                id="sendAccessEmail"
                checked={!!sendAccessEmail}
                onCheckedChange={(v) => setValue('sendAccessEmail', v, { shouldValidate: true })}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="sendAccessEmail" className="cursor-pointer">{t('usersPage.sendAccessEmail')}</Label>
                <p className="text-xs text-muted-foreground">{t('usersPage.sendAccessEmailHint')}</p>
              </div>
            </div>
          )}

          {/* Contraseña (no se pide si se genera para el correo de acceso) */}
          {!autoPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="password">
                {isEdit ? t('usersPage.newPassword') : t('usersPage.passwordRequired')}
                {isEdit && (
                  <span className="text-muted-foreground font-normal ml-1">{t('usersPage.passwordHint')}</span>
                )}
              </Label>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
          )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('usersPage.saving') : isEdit ? t('usersPage.saveChanges') : t('usersPage.createUser')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Página de usuarios ───────────────────────────────────────────────────────

const UsersPage = () => {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const [users, setUsers]       = useState([]);
  // Orden por columna (2026-11-24): key null = orden del servidor (más recientes primero).
  const [sort, setSort]         = useState({ key: null, dir: 'asc' });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('client'); // enfocado en clientes por defecto
  const [modal, setModal]       = useState({ open: false, user: null });
  const [deleting, setDeleting] = useState(null); // usuario a eliminar
  const [resending, setResending] = useState(null); // cliente al que se reenvía el acceso
  const [resendBusy, setResendBusy] = useState(false);

  // Se traen TODAS las páginas (2026-11-24) para poder ordenar por columna
  // sobre la lista completa (antes eran 25 + "Cargar más"). Son pocas decenas
  // de usuarios: una llamada por cada 100.
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const all = [];
      let result = await listUsers({ pageSize: 100, search });
      all.push(...result.data);
      while (result.nextLink) {
        result = await listUsers({ nextLink: result.nextLink });
        all.push(...result.data);
      }

      // Filtrar por rol en cliente (el backend no soporta filtro de rol aún)
      setUsers(roleFilter ? all.filter((u) => u.role === roleFilter) : all);
    } catch (err) {
      setError(err.response?.data?.error || t('usersPage.loadError'));
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, t]);

  useEffect(() => {
    setUsers([]);
    fetchUsers();
  }, [search, roleFilter]);

  // Valor de orden de cada columna. Vacíos (sin vínculo, nunca entró) siempre al final.
  const sortedUsers = useMemo(() => {
    if (!sort.key) return users;
    const SORT_VALUE = {
      user:       (u) => u.fullName || u.email,
      role:       (u) => t(ROLE_LABEL_KEY[u.role]),
      status:     (u) => (u.isActive ? 0 : 1),
      contact:    (u) => (u.d365ContactId ? (u.contactName || u.d365ContactId) : null),
      account:    (u) => (u.d365AccountId ? (u.accountName || u.d365AccountId) : null),
      lastAccess: (u) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : null),
    };
    const get = SORT_VALUE[sort.key];
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...users].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
      return cmp * factor;
    });
  }, [users, sort, t]);

  // Clic en el encabezado: ascendente → descendente → sin orden.
  const toggleSort = (key) => setSort((s) => {
    if (s.key !== key) return { key, dir: 'asc' };
    if (s.dir === 'asc') return { key, dir: 'desc' };
    return { key: null, dir: 'asc' };
  });

  const COLUMNS = [
    { key: 'user',       label: t('usersPage.colUser') },
    { key: 'role',       label: t('usersPage.colRole') },
    { key: 'status',     label: t('table.status') },
    { key: 'contact',    label: t('usersPage.colContact') },
    { key: 'account',    label: t('usersPage.colAccount') },
    { key: 'lastAccess', label: t('usersPage.colLastAccess') },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const val = e.target.elements.search.value.trim();
    setSearch(val);
  };

  const openCreate  = () => setModal({ open: true, user: null });
  const openEdit    = (u) => setModal({ open: true, user: u });
  const closeModal  = () => setModal({ open: false, user: null });

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteUser(deleting.id);
      toast.success(t('usersPage.deletedToast', { name: deleting.fullName }));
      setDeleting(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('usersPage.deleteError'));
    }
  };

  // Reenviar acceso (2026-11-23): contraseña temporal NUEVA por correo.
  const handleResend = async () => {
    if (!resending) return;
    setResendBusy(true);
    try {
      await resendAccess(resending.id);
      toast.success(t('usersPage.resendQueued', { email: resending.email }));
      setResending(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('usersPage.resendError'), { duration: 10000 });
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('usersPage.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('usersPage.subtitle')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('usersPage.newUser')}
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            name="search"
            placeholder={t('usersPage.searchPlaceholder')}
            defaultValue={search}
            className="w-64"
          />
          <Button type="submit" variant="secondary" size="sm">
            <Search className="mr-2 h-4 w-4" />
            {t('common.search')}
          </Button>
        </form>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('usersPage.allRoles')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="client">{t('usersPage.roleClientPlural')}</SelectItem>
            <SelectItem value="support">{t('usersPage.roleSupport')}</SelectItem>
            <SelectItem value="consultor">{t('usersPage.roleConsultor')}</SelectItem>
            <SelectItem value="admin">{t('usersPage.roleAdmin')}</SelectItem>
            <SelectItem value="">{t('usersPage.allRoles')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-muted-foreground">
            {loading && users.length === 0
              ? t('common.loadingEllipsis')
              : t('usersPage.userCount', { count: users.length, plus: '' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && users.length === 0 ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              {t('usersPage.noUsersFound')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    {COLUMNS.map(({ key, label }) => {
                      const active = sort.key === key;
                      const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                      return (
                        <th
                          key={key}
                          className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap"
                          aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(key)}
                            className={cn('inline-flex items-center gap-1.5 hover:text-foreground transition-colors', active && 'text-foreground')}
                          >
                            {label}
                            <Icon className={cn('h-3.5 w-3.5', !active && 'opacity-40')} />
                          </button>
                        </th>
                      );
                    })}
                    <th className="px-6 py-3" />

                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      {/* Usuario */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {initials(u.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{u.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="px-6 py-3">
                        <Badge variant={ROLE_VARIANT[u.role]}>{t(ROLE_LABEL_KEY[u.role])}</Badge>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <UserCheck className="h-3.5 w-3.5" /> {t('status.active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <UserX className="h-3.5 w-3.5" /> {t('usersPage.userInactive')}
                          </span>
                        )}
                        {u.mustChangePassword && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 whitespace-nowrap">
                            <KeyRound className="h-3 w-3" /> {t('usersPage.pendingPasswordChange')}
                          </span>
                        )}
                        {u.mfaEnabled && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-400 whitespace-nowrap">
                            <ShieldCheck className="h-3 w-3" /> {t('usersPage.mfaOn')}
                          </span>
                        )}
                      </td>

                      {/* Contacto */}
                      <td className="px-6 py-3">
                        {u.d365ContactId ? (
                          <p className={cn('text-xs font-medium truncate max-w-[180px]', !u.contactName && 'font-mono')} title={u.d365ContactId}>
                            {u.contactName || shortGuid(u.d365ContactId)}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">{t('usersPage.notLinked')}</span>
                        )}
                      </td>

                      {/* Cuenta */}
                      <td className="px-6 py-3">
                        {u.d365AccountId ? (
                          <p className={cn('text-xs font-medium truncate max-w-[180px]', !u.accountName && 'font-mono')} title={u.d365AccountId}>
                            {u.accountName || shortGuid(u.d365AccountId)}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">{t('usersPage.notLinked')}</span>
                        )}
                      </td>

                      {/* Último acceso */}
                      <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                        {u.lastLoginAt
                          ? format(new Date(u.lastLoginAt), datePattern(dateLocale, 'dateTime'), { locale: dateLocale })
                          : <span className="italic text-xs">{t('usersPage.never')}</span>}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {u.role === 'client' && u.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setResending(u)}
                              className="h-8 w-8 p-0"
                              title={t('usersPage.resendAccess')}
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span className="sr-only">{t('usersPage.resendAccess')}</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">{t('usersPage.edit')}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(u)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">{t('common.delete')}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </CardContent>
      </Card>

      <UserFormModal
        user={modal.user}
        open={modal.open}
        onClose={closeModal}
        onSuccess={fetchUsers}
      />

      {/* Confirmación de reenvío de acceso (reemplaza la contraseña actual) */}
      <Dialog open={!!resending} onOpenChange={(o) => { if (!o && !resendBusy) setResending(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('usersPage.resendTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('usersPage.resendConfirm', { name: resending?.fullName, email: resending?.email })}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResending(null)} disabled={resendBusy}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleResend} disabled={resendBusy}>
              <Send className="mr-2 h-4 w-4" /> {resendBusy ? t('usersPage.resendSending') : t('usersPage.resendSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de borrado */}
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('usersPage.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('usersPage.deleteConfirmPrefix')}{' '}
            <span className="font-semibold text-foreground">{deleting?.fullName}</span>?
            {' '}{t('usersPage.deleteConfirmSuffix')}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
