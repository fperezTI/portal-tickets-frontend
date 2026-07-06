import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createCase } from '../api/cases';
import { listServiceCategories, listSystems, listAreas } from '../api/d365';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import D365Combobox from '../components/D365Combobox';
import PolicyCombobox from '../components/PolicyCombobox';
import { ArrowLeft, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const STAFF_ROLES = ['admin', 'support'];

const CASE_TYPE_OPTIONS = [
  { value: '1', label: 'Pregunta' },
  { value: '2', label: 'Problema' },
  { value: '3', label: 'Solicitud' },
];

const ORIGIN_OPTIONS = [
  { value: '1', label: 'Teléfono' },
  { value: '2', label: 'Correo' },
  { value: '3', label: 'Web' },
  { value: '2483', label: 'Facebook' },
  { value: '3986', label: 'Twitter' },
];

const schema = z.object({
  title:             z.string().min(1, 'El título es requerido'),
  description:       z.string().min(1, 'La descripción es requerida'),
  priority:          z.string().optional(),
  caseType:          z.string().optional(),
  serviceCategoryId: z.string().min(1, 'La categoría de servicio es requerida'),
  systemId:          z.string().min(1, 'El sistema es requerido'),
  areaId:            z.string().min(1, 'El módulo es requerido'),
  customerAccountId: z.string().optional(),
  contactId:         z.string().optional(),
  customerUserId:    z.string().optional(),
  origin:            z.string().optional(),
  policyId:          z.string().optional(),
});

const CatalogSelect = ({ label, required, placeholder, options, value, onChange, error, loading, disabled }) => (
  <div className="space-y-1.5">
    <Label>{label} {required && '*'}</Label>
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={loading ? 'Cargando…' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

// ─── Formulario ────────────────────────────────────────────────────────────────
// Se remonta por completo (vía `key` en el padre) cada vez que se crea un ticket
// y el usuario pulsa "Crear otro": así se garantiza un estado 100% limpio (react-hook-form,
// D365Combobox) sin depender de las particularidades de reset()/clearErrors().
const TicketForm = ({ isStaff, user, catalogsLoading, serviceCategories, systems, areas, onCreateAnother }) => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [createdCase, setCreatedCase] = useState(null);

  const ownAccountId = user?.d365AccountId || '';
  const ownContactId = user?.d365ContactId || '';
  const [policyLabel, setPolicyLabel] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      priority: '2',
      caseType: '2',
      origin: '3',
      serviceCategoryId: '',
      systemId: '',
      areaId: '',
      customerAccountId: isStaff ? '' : ownAccountId,
      contactId:         isStaff ? '' : ownContactId,
      customerUserId:    isStaff ? '' : ownContactId,
      policyId:          '',
    },
  });

  const onSubmit = async (data) => {
    setError('');
    if (isStaff && !data.customerAccountId) {
      setError('Selecciona un cliente antes de crear el ticket');
      return;
    }
    try {
      const newCase = await createCase({
        title:             data.title,
        description:       data.description,
        priority:          data.priority ? parseInt(data.priority) : undefined,
        caseType:          data.caseType ? parseInt(data.caseType) : undefined,
        serviceCategoryId: data.serviceCategoryId,
        systemId:          data.systemId || undefined,
        areaId:            data.areaId || undefined,
        // El staff elige libremente cliente/contacto/origen; para clientes el
        // backend siempre usa su propio registro sin importar lo que se envíe aquí.
        ...(isStaff
          ? {
              customerAccountId: data.customerAccountId || undefined,
              contactId:         data.contactId || undefined,
              customerUserId:    data.customerUserId || undefined,
              origin:            data.origin ? parseInt(data.origin) : undefined,
              policyId:          data.policyId || undefined,
            }
          : {}),
      });
      toast.success('Ticket creado correctamente');
      // Se permanece en la misma pantalla, con los datos capturados visibles,
      // en lugar de navegar a la lista de tickets.
      setCreatedCase(newCase);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el ticket');
    }
  };

  const hasCustomer = isStaff || !!(ownAccountId || ownContactId);
  // Una vez creado el ticket, todo el formulario queda bloqueado hasta que se
  // pulse "Crear otro" (remonta el componente con los campos correctos desbloqueados).
  const locked = !!createdCase;

  if (!hasCustomer) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Tu usuario no está vinculado a un contacto o cuenta de Dynamics 365. Contacta a un administrador para poder crear tickets.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {createdCase && (
        <Alert style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
          <CheckCircle2 className="h-4 w-4" style={{ color: '#16A34A' }} />
          <AlertDescription style={{ color: '#166534' }}>
            Ticket <strong>{createdCase.ticketnumber}</strong> creado correctamente.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ticketnumber" className="flex items-center gap-1.5">
            Número de caso <Lock className="h-3 w-3 text-muted-foreground" />
          </Label>
          <Input
            id="ticketnumber"
            disabled
            value={createdCase?.ticketnumber || ''}
            placeholder="Se asigna automáticamente al crear el ticket"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner" className="flex items-center gap-1.5">
            Responsable <Lock className="h-3 w-3 text-muted-foreground" />
          </Label>
          <Input
            id="owner"
            disabled
            value={createdCase?.ownerName || 'Soporte Grupo Staff'}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Título {!locked && '*'}</Label>
        <Input
          id="title"
          placeholder="Resumen breve del problema"
          disabled={locked}
          {...register('title')}
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            Cliente {isStaff && !locked && '*'} {!isStaff && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          <D365Combobox
            entityType={isStaff || ownAccountId ? 'account' : 'contact'}
            value={watch('customerAccountId')}
            onChange={(id) => setValue('customerAccountId', id, { shouldValidate: true })}
            disabled={!isStaff || locked}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            Contacto {!isStaff && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          <D365Combobox
            entityType="contact"
            value={watch('contactId')}
            onChange={(id) => setValue('contactId', id, { shouldValidate: true })}
            disabled={!isStaff || locked}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            Usuario cliente {!isStaff && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          <D365Combobox
            entityType="contact"
            value={watch('customerUserId')}
            onChange={(id) => setValue('customerUserId', id, { shouldValidate: true })}
            disabled={!isStaff || locked}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            Origen {!isStaff && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          <Select
            value={watch('origin')}
            onValueChange={(val) => setValue('origin', val)}
            disabled={!isStaff || locked}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIGIN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isStaff && (
        <div className="space-y-1.5">
          <Label>Póliza (opcional)</Label>
          <PolicyCombobox
            value={watch('policyId')}
            label={policyLabel}
            onChange={(id, name) => { setValue('policyId', id); setPolicyLabel(name); }}
            disabled={locked}
            placeholder="Buscar póliza para vincular al ticket…"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Prioridad</Label>
          <Select
            value={watch('priority')}
            onValueChange={(val) => setValue('priority', val)}
            disabled={locked}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Crítica</SelectItem>
              <SelectItem value="1">Alta</SelectItem>
              <SelectItem value="2">Normal</SelectItem>
              <SelectItem value="3">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Tipo de caso</Label>
          <Select
            value={watch('caseType')}
            onValueChange={(val) => setValue('caseType', val)}
            disabled={locked}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un tipo" />
            </SelectTrigger>
            <SelectContent>
              {CASE_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CatalogSelect
          label="Categoría de servicio"
          required={!locked}
          placeholder="Selecciona una categoría"
          options={serviceCategories}
          loading={catalogsLoading}
          value={watch('serviceCategoryId')}
          onChange={(val) => setValue('serviceCategoryId', val, { shouldValidate: true })}
          error={errors.serviceCategoryId?.message}
          disabled={locked}
        />

        <CatalogSelect
          label="Sistema"
          required={!locked}
          placeholder="Selecciona un sistema"
          options={systems}
          loading={catalogsLoading}
          value={watch('systemId')}
          onChange={(val) => setValue('systemId', val, { shouldValidate: true })}
          error={errors.systemId?.message}
          disabled={locked}
        />

        <CatalogSelect
          label="Módulo"
          required={!locked}
          placeholder="Selecciona un módulo"
          options={areas}
          loading={catalogsLoading}
          value={watch('areaId')}
          onChange={(val) => setValue('areaId', val, { shouldValidate: true })}
          error={errors.areaId?.message}
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción {!locked && '*'}</Label>
        <Textarea
          id="description"
          placeholder="Describe el problema con el mayor detalle posible..."
          rows={6}
          disabled={locked}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        {createdCase ? (
          <Button type="button" onClick={onCreateAnother}>
            Crear otro
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Crear Ticket'}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => navigate('/cases')}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

// ─── Página ────────────────────────────────────────────────────────────────────
const NewCasePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);

  const [formKey, setFormKey] = useState(0);
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [systems, setSystems] = useState([]);
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    Promise.all([listServiceCategories(), listSystems(), listAreas()])
      .then(([categories, sys, ar]) => {
        setServiceCategories(categories);
        setSystems(sys);
        setAreas(ar);
      })
      .catch(() => {})
      .finally(() => setCatalogsLoading(false));
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cases')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">Nuevo Ticket</h1>
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}
          title="Los tickets creados desde el portal siempre quedan marcados como tal"
        >
          <Lock className="h-3 w-3" /> Portal: Sí
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalles de la solicitud</CardTitle>
          <CardDescription>
            Completa la información para abrir un ticket de soporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TicketForm
            key={formKey}
            isStaff={isStaff}
            user={user}
            catalogsLoading={catalogsLoading}
            serviceCategories={serviceCategories}
            systems={systems}
            areas={areas}
            onCreateAnother={() => setFormKey((k) => k + 1)}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default NewCasePage;
