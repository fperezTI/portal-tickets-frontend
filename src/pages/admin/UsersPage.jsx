import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { listUsers, createUser, updateUser, deleteUser } from '../../api/users';
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
import { Plus, Search, Pencil, Link, UserCheck, UserX, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL   = { admin: 'Admin', support: 'Soporte', client: 'Cliente' };
const ROLE_VARIANT = { admin: 'default', support: 'outline', client: 'secondary' };

const initials = (name) =>
  (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

const shortGuid = (guid) => (guid ? `${guid.slice(0, 8)}…` : null);

// ─── Esquemas de validación ───────────────────────────────────────────────────

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

const createSchema = z.object({
  email:          z.string().email('Email inválido'),
  fullName:       z.string().min(1, 'Nombre requerido'),
  password:       passwordRules,
  role:           z.enum(['admin', 'support', 'client']),
  d365ContactId:  guidOrEmpty,
  d365AccountId:  guidOrEmpty,
});

const editSchema = z.object({
  fullName:       z.string().min(1, 'Nombre requerido'),
  role:           z.enum(['admin', 'support', 'client']),
  isActive:       z.boolean(),
  d365ContactId:  guidOrEmpty,
  d365AccountId:  guidOrEmpty,
  password:       z.union([passwordRules, z.literal('')]).optional(),
});

// ─── Modal de creación / edición ──────────────────────────────────────────────

const UserFormModal = ({ user, open, onClose, onSuccess }) => {
  const isEdit   = !!user;
  const schema   = isEdit ? editSchema : createSchema;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(schema),
      defaultValues: isEdit
        ? {
            fullName:      user.fullName || '',
            role:          user.role || 'client',
            isActive:      user.isActive ?? true,
            d365ContactId: user.d365ContactId || '',
            d365AccountId: user.d365AccountId || '',
            password:      '',
          }
        : { email: '', fullName: '', password: '', role: 'client', d365ContactId: '', d365AccountId: '' },
    });

  // Sincronizar defaults cuando cambia el usuario seleccionado
  useEffect(() => {
    if (open) {
      reset(
        isEdit
          ? {
              fullName:      user.fullName || '',
              role:          user.role || 'client',
              isActive:      user.isActive ?? true,
              d365ContactId: user.d365ContactId || '',
              d365AccountId: user.d365AccountId || '',
              password:      '',
            }
          : { email: '', fullName: '', password: '', role: 'client', d365ContactId: '', d365AccountId: '' }
      );
    }
  }, [open, user]);

  const isActive = watch('isActive');

  const onSubmit = async (data) => {
    try {
      const payload = { ...data };
      // null = borrar vínculo; undefined (ausente) = no tocar
      payload.d365ContactId = payload.d365ContactId || null;
      payload.d365AccountId = payload.d365AccountId || null;
      if (isEdit && !payload.password) delete payload.password;

      if (isEdit) {
        await updateUser(user.id, payload);
        toast.success('Usuario actualizado correctamente');
      } else {
        await createUser(payload);
        toast.success('Usuario creado correctamente');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar el usuario');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar: ${user.fullName}` : 'Nuevo Usuario'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Email (solo en creación) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" placeholder="usuario@empresa.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          )}

          {/* Nombre completo */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nombre completo *</Label>
            <Input id="fullName" placeholder="Nombre Apellido" {...register('fullName')} />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
          </div>

          {/* Rol */}
          <div className="space-y-1.5">
            <Label>Rol *</Label>
            <Select
              defaultValue={isEdit ? user.role : 'client'}
              onValueChange={(v) => setValue('role', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="support">Soporte</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          {/* Estado activo (solo en edición) */}
          {isEdit && (
            <div className="flex items-center gap-3">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(v) => setValue('isActive', v)}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                {isActive ? 'Usuario activo' : 'Usuario inactivo'}
              </Label>
            </div>
          )}

          {/* Separador de sección D365 */}
          <div className="pt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Link className="h-3 w-3" />
              Vinculación Dynamics 365
            </p>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Contacto
                  <span className="text-muted-foreground font-normal ml-1">— persona responsable del ticket</span>
                </Label>
                <D365Combobox
                  entityType="contact"
                  value={watch('d365ContactId') || ''}
                  onChange={(id) => setValue('d365ContactId', id, { shouldValidate: true })}
                />
                {errors.d365ContactId && (
                  <p className="text-xs text-destructive">{errors.d365ContactId.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">
                  Empresa / Cuenta
                  <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                </Label>
                <D365Combobox
                  entityType="account"
                  value={watch('d365AccountId') || ''}
                  onChange={(id) => setValue('d365AccountId', id, { shouldValidate: true })}
                />
                {errors.d365AccountId && (
                  <p className="text-xs text-destructive">{errors.d365AccountId.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <Label htmlFor="password">
              {isEdit ? 'Nueva contraseña' : 'Contraseña *'}
              {isEdit && (
                <span className="text-muted-foreground font-normal ml-1">(dejar vacío para no cambiar)</span>
              )}
            </Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Página de usuarios ───────────────────────────────────────────────────────

const UsersPage = () => {
  const [users, setUsers]       = useState([]);
  const [nextLink, setNextLink] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('client'); // enfocado en clientes por defecto
  const [modal, setModal]       = useState({ open: false, user: null });
  const [deleting, setDeleting] = useState(null); // usuario a eliminar

  const fetchUsers = useCallback(async (link = null) => {
    try {
      setLoading(true);
      setError('');
      const params = link ? { nextLink: link } : { pageSize: 25, search };
      const result = await listUsers(params);

      // Filtrar por rol en cliente (el backend no soporta filtro de rol aún)
      const filtered = roleFilter
        ? result.data.filter((u) => u.role === roleFilter)
        : result.data;

      setUsers((prev) => (link ? [...prev, ...filtered] : filtered));
      setNextLink(result.nextLink);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    setUsers([]);
    setNextLink(null);
    fetchUsers();
  }, [search, roleFilter]);

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
      toast.success(`Usuario "${deleting.fullName}" eliminado`);
      setDeleting(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar el usuario');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea y vincula usuarios del portal a contactos de Dynamics 365
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            name="search"
            placeholder="Buscar por nombre o email…"
            defaultValue={search}
            className="w-64"
          />
          <Button type="submit" variant="secondary" size="sm">
            <Search className="mr-2 h-4 w-4" />
            Buscar
          </Button>
        </form>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Todos los roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="client">Clientes</SelectItem>
            <SelectItem value="support">Soporte</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="">Todos</SelectItem>
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
              ? 'Cargando…'
              : `${users.length}${nextLink ? '+' : ''} usuario${users.length !== 1 ? 's' : ''}`}
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
              No se encontraron usuarios.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    {['Usuario', 'Rol', 'Estado', 'Contacto (D365)', 'Cuenta (D365)', 'Último acceso', ''].map((h) => (
                      <th key={h} className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
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
                        <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <UserCheck className="h-3.5 w-3.5" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <UserX className="h-3.5 w-3.5" /> Inactivo
                          </span>
                        )}
                      </td>

                      {/* Contacto */}
                      <td className="px-6 py-3">
                        {u.d365ContactId ? (
                          <p className="text-xs font-medium truncate max-w-[180px]" title={u.d365ContactId}>
                            {u.contactName || shortGuid(u.d365ContactId)}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sin vincular</span>
                        )}
                      </td>

                      {/* Cuenta */}
                      <td className="px-6 py-3">
                        {u.d365AccountId ? (
                          <p className="text-xs font-medium truncate max-w-[180px]" title={u.d365AccountId}>
                            {u.accountName || shortGuid(u.d365AccountId)}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sin vincular</span>
                        )}
                      </td>

                      {/* Último acceso */}
                      <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                        {u.lastLoginAt
                          ? format(new Date(u.lastLoginAt), 'dd MMM yyyy HH:mm', { locale: es })
                          : <span className="italic text-xs">Nunca</span>}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(u)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {nextLink && !loading && (
            <div className="p-4 text-center border-t">
              <Button variant="outline" size="sm" onClick={() => fetchUsers(nextLink)}>
                Cargar más
              </Button>
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

      {/* Diálogo de confirmación de borrado */}
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            ¿Estás seguro de que deseas eliminar a{' '}
            <span className="font-semibold text-foreground">{deleting?.fullName}</span>?
            Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
