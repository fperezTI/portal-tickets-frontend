import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
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

const CASE_TYPE_KEYS = [
  { value: '1', key: 'newCase.caseTypeQuestion' },
  { value: '2', key: 'newCase.caseTypeProblem' },
  { value: '3', key: 'newCase.caseTypeRequest' },
];

const ORIGIN_KEYS = [
  { value: '1',    key: 'newCase.originPhone' },
  { value: '2',    key: 'newCase.originEmail' },
  { value: '3',    key: 'newCase.originWeb' },
  { value: '2483', key: 'newCase.originFacebook' },
  { value: '3986', key: 'newCase.originTwitter' },
];

const useCaseSchema = () => {
  const { t } = useTranslation();
  return useMemo(() => z.object({
    title:             z.string().min(1, t('newCase.titleRequired')),
    description:       z.string().min(1, t('newCase.descriptionRequired')),
    priority:          z.string().optional(),
    caseType:          z.string().optional(),
    serviceCategoryId: z.string().min(1, t('newCase.serviceCategoryRequired')),
    systemId:          z.string().min(1, t('newCase.systemRequired')),
    areaId:            z.string().min(1, t('newCase.areaRequired')),
    customerAccountId: z.string().optional(),
    contactId:         z.string().optional(),
    customerUserId:    z.string().optional(),
    origin:            z.string().optional(),
    policyId:          z.string().optional(),
  }), [t]);
};

const CatalogSelect = ({ label, required, placeholder, options, value, onChange, error, loading, disabled }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <Label>{label} {required && '*'}</Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? t('common.loadingEllipsis') : placeholder} />
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
};

// ─── Formulario ────────────────────────────────────────────────────────────────
// Se remonta por completo (vía `key` en el padre) cada vez que se crea un ticket
// y el usuario pulsa "Crear otro": así se garantiza un estado 100% limpio (react-hook-form,
// D365Combobox) sin depender de las particularidades de reset()/clearErrors().
const TicketForm = ({ isStaff, user, catalogsLoading, serviceCategories, systems, areas, onCreateAnother }) => {
  const { t } = useTranslation();
  const schema = useCaseSchema();
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
      setError(t('newCase.selectCustomerFirst'));
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
      toast.success(t('newCase.createdToast'));
      // Se permanece en la misma pantalla, con los datos capturados visibles,
      // en lugar de navegar a la lista de tickets.
      setCreatedCase(newCase);
    } catch (err) {
      setError(err.response?.data?.error || t('newCase.createError'));
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
          {t('newCase.noCustomerLinked')}
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
            {t('newCase.createdBannerPrefix')} <strong>{createdCase.ticketnumber}</strong> {t('newCase.createdBannerSuffix')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ticketnumber" className="flex items-center gap-1.5">
            {t('newCase.caseNumber')} <Lock className="h-3 w-3 text-muted-foreground" />
          </Label>
          <Input
            id="ticketnumber"
            disabled
            value={createdCase?.ticketnumber || ''}
            placeholder={t('newCase.caseNumberPlaceholder')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner" className="flex items-center gap-1.5">
            {t('table.owner')} <Lock className="h-3 w-3 text-muted-foreground" />
          </Label>
          <Input
            id="owner"
            disabled
            value={createdCase?.ownerName || t('newCase.defaultOwner')}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">{t('table.title')} {!locked && '*'}</Label>
        <Input
          id="title"
          placeholder={t('newCase.titlePlaceholder')}
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
            {t('table.customer')} {isStaff && !locked && '*'} {!isStaff && <Lock className="h-3 w-3 text-muted-foreground" />}
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
            {t('table.contact')} {!isStaff && <Lock className="h-3 w-3 text-muted-foreground" />}
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
            {t('caseDetail.customerUser')} {!isStaff && <Lock className="h-3 w-3 text-muted-foreground" />}
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
            {t('caseDetail.origin')} {!isStaff && <Lock className="h-3 w-3 text-muted-foreground" />}
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
              {ORIGIN_KEYS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{t(o.key)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isStaff && (
        <div className="space-y-1.5">
          <Label>{t('newCase.policyOptional')}</Label>
          <PolicyCombobox
            value={watch('policyId')}
            label={policyLabel}
            onChange={(id, name) => { setValue('policyId', id); setPolicyLabel(name); }}
            disabled={locked}
            placeholder={t('newCase.policySearchPlaceholder')}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t('table.priority')}</Label>
          <Select
            value={watch('priority')}
            onValueChange={(val) => setValue('priority', val)}
            disabled={locked}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t('priority.critical')}</SelectItem>
              <SelectItem value="1">{t('priority.high')}</SelectItem>
              <SelectItem value="2">{t('priority.normal')}</SelectItem>
              <SelectItem value="3">{t('priority.low')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('caseDetail.caseType')}</Label>
          <Select
            value={watch('caseType')}
            onValueChange={(val) => setValue('caseType', val)}
            disabled={locked}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('newCase.selectType')} />
            </SelectTrigger>
            <SelectContent>
              {CASE_TYPE_KEYS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{t(o.key)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CatalogSelect
          label={t('caseDetail.serviceCategory')}
          required={!locked}
          placeholder={t('newCase.selectCategory')}
          options={serviceCategories}
          loading={catalogsLoading}
          value={watch('serviceCategoryId')}
          onChange={(val) => setValue('serviceCategoryId', val, { shouldValidate: true })}
          error={errors.serviceCategoryId?.message}
          disabled={locked}
        />

        <CatalogSelect
          label={t('caseDetail.system')}
          required={!locked}
          placeholder={t('newCase.selectSystem')}
          options={systems}
          loading={catalogsLoading}
          value={watch('systemId')}
          onChange={(val) => setValue('systemId', val, { shouldValidate: true })}
          error={errors.systemId?.message}
          disabled={locked}
        />

        <CatalogSelect
          label={t('caseDetail.module')}
          required={!locked}
          placeholder={t('newCase.selectModule')}
          options={areas}
          loading={catalogsLoading}
          value={watch('areaId')}
          onChange={(val) => setValue('areaId', val, { shouldValidate: true })}
          error={errors.areaId?.message}
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t('caseDetail.description')} {!locked && '*'}</Label>
        <Textarea
          id="description"
          placeholder={t('newCase.descriptionPlaceholder')}
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
            {t('newCase.createAnother')}
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('newCase.submitting') : t('newCase.createTicket')}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => navigate('/cases')}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
};

// ─── Página ────────────────────────────────────────────────────────────────────
const NewCasePage = () => {
  const { t } = useTranslation();
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
          <h1 className="text-xl font-semibold">{t('nav.newTicket')}</h1>
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}
          title={t('newCase.portalBadgeTitle')}
        >
          <Lock className="h-3 w-3" /> {t('newCase.portalBadge')}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('newCase.requestDetails')}</CardTitle>
          <CardDescription>
            {t('newCase.requestDetailsSubtitle')}
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
