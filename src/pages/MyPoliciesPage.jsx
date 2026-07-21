import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useDateLocale } from '../hooks/useDateLocale';
import { listMyPolicies, listPolicyCustomers } from '../api/policies';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RefreshCw, ShieldOff, Users } from 'lucide-react';
import DataTable from '../components/DataTable';
import { fmtHours } from '@/lib/utils';

const STAFF_ROLES = ['admin', 'support'];

// Dataverse expone estos campos como "solo fecha"; reconstruir con `new Date(iso)`
// puede recorrer un día por la zona horaria del navegador. Se usa el valor ya
// formateado por Dataverse (M/D/YYYY, el mismo que muestra Customer Service) y
// solo se reordena a la convención visual de la app, sin pasar por Date/UTC.
const parseUSDate = (str) => {
  if (!str) return null;
  const [m, d, y] = str.split('/').map(Number);
  return new Date(y, m - 1, d);
};
const fmtUSDate = (str, locale) => {
  const date = parseUSDate(str);
  return date ? format(date, 'dd MMM yyyy', { locale }) : null;
};

// ─── Estado sin contacto/cuenta vinculada ─────────────────────────────────────
const NotLinkedState = () => {
  const { t } = useTranslation();
  return (
    <div className="py-16 text-center space-y-3">
      <ShieldOff className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <p className="font-medium text-sm">{t('cases.notLinkedTitle')}</p>
      <p className="text-muted-foreground text-xs max-w-xs mx-auto">
        {t('cases.notLinkedBody')}
      </p>
    </div>
  );
};

// ─── Estado: staff sin cliente seleccionado ───────────────────────────────────
const SelectClientState = () => {
  const { t } = useTranslation();
  return (
    <div className="py-16 text-center space-y-3">
      <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <p className="font-medium text-sm">{t('policies.selectClient')}</p>
      <p className="text-muted-foreground text-xs max-w-xs mx-auto">
        {t('policies.selectClientBody')}
      </p>
    </div>
  );
};

// ─── Badge de estado ───────────────────────────────────────────────────────────
const PolicyStatusBadge = ({ statecode }) => {
  const { t } = useTranslation();
  const active = statecode === 0;
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
      style={active
        ? { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }
        : { background: '#F4F4F5', color: '#71717A', border: '1px solid #E4E4E7' }}
    >
      {active ? t('policies.active') : t('policies.inactive')}
    </span>
  );
};

// ─── Tabla ─────────────────────────────────────────────────────────────────────
const PoliciesTable = ({ policies, onRowClick }) => {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const columns = [
    { key: 'poliza', label: t('policies.policy'), width: 160, accessor: (p) => p.name,
      render: (p) => <span className="text-sm font-bold">{p.name}</span> },
    { key: 'inicio', label: t('policies.startDate'), width: 130, filterType: 'none',
      accessor: (p) => parseUSDate(p.startDateFormatted),
      render: (p) => <span className="text-muted-foreground whitespace-nowrap">{fmtUSDate(p.startDateFormatted, dateLocale) || '—'}</span> },
    { key: 'vencimiento', label: t('policies.dueDate'), width: 150, filterType: 'none',
      accessor: (p) => parseUSDate(p.dueDateFormatted),
      render: (p) => <span className="text-muted-foreground whitespace-nowrap">{fmtUSDate(p.dueDateFormatted, dateLocale) || '—'}</span> },
    { key: 'contratadas', label: t('policies.contractedHours'), width: 150, filterType: 'none',
      accessor: (p) => p.totalHours,
      render: (p) => <span className="whitespace-nowrap">{p.totalHours != null ? `${fmtHours(p.totalHours)} h` : '—'}</span> },
    { key: 'consumidas', label: t('policies.consumedHours'), width: 150, filterType: 'none',
      accessor: (p) => p.consumedHours,
      render: (p) => <span className="whitespace-nowrap">{p.consumedHours != null ? `${fmtHours(p.consumedHours)} h` : '—'}</span> },
    { key: 'disponibles', label: t('policies.availableHours'), width: 150, filterType: 'none',
      accessor: (p) => (p.totalHours != null && p.consumedHours != null ? p.totalHours - p.consumedHours : null),
      render: (p) => (
        <span className="whitespace-nowrap font-medium">
          {p.totalHours != null && p.consumedHours != null ? `${fmtHours(p.totalHours - p.consumedHours)} h` : '—'}
        </span>
      ) },
    { key: 'estado', label: t('table.status'), width: 130, filterType: 'select',
      accessor: (p) => (p.statecode === 0 ? t('policies.active') : t('policies.inactive')),
      render: (p) => <PolicyStatusBadge statecode={p.statecode} /> },
  ];

  return (
    <DataTable
      columns={columns}
      data={policies}
      getRowKey={(p) => p.id}
      onRowClick={(p) => onRowClick(p.id)}
      maxHeight="calc(100vh-260px)"
    />
  );
};

// ─── Página ────────────────────────────────────────────────────────────────────
const MyPoliciesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);

  // El cliente seleccionado vive en la URL (no en useState) para que, al
  // volver desde el detalle de una póliza, se conserve el mismo cliente y
  // listado en vez de reiniciar la página en blanco.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClientId = searchParams.get('client') || '';
  const setSelectedClientId = (clientId) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (clientId) next.set('client', clientId); else next.delete('client');
    return next;
  }, { replace: true });

  const [clients, setClients] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [nextLink, setNextLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isStaff) return;
    listPolicyCustomers().then(setClients).catch(() => {});
  }, [isStaff]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const hasCustomer = isStaff ? !!selectedClient : !!(user?.d365AccountId || user?.d365ContactId);

  const fetchPolicies = useCallback(async (link = null) => {
    if (!hasCustomer) return;
    try {
      setLoading(true);
      setError('');
      const params = link
        ? { nextLink: link }
        : {
            ...(isStaff && selectedClient?.type === 'contact' ? { contactId: selectedClient.id } : {}),
            ...(isStaff && selectedClient?.type === 'account' ? { accountId: selectedClient.id } : {}),
          };
      const result = await listMyPolicies(params);
      setPolicies((prev) => (link ? [...prev, ...result.data] : result.data));
      setNextLink(result.nextLink);
    } catch (err) {
      setError(err.response?.data?.error || t('policies.loadError'));
    } finally {
      setLoading(false);
    }
  }, [hasCustomer, isStaff, selectedClient, t]);

  useEffect(() => {
    setPolicies([]);
    setNextLink(null);
    fetchPolicies();
  }, [fetchPolicies]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{isStaff ? t('nav.policies') : t('nav.myPolicies')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isStaff ? t('policies.byCustomer') : t('policies.forYourAccount')}
        </p>
      </div>

      {isStaff && clients.length > 0 && (
        <Select value={selectedClientId || 'none'} onValueChange={(v) => setSelectedClientId(v === 'none' ? '' : v)}>
          <SelectTrigger className="w-64 h-9 text-sm">
            <SelectValue placeholder={t('policies.selectClient')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('policies.selectClient')}</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={() => fetchPolicies()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {!isStaff && !hasCustomer && <NotLinkedState />}
          {isStaff && !hasCustomer && <SelectClientState />}

          {loading && policies.length === 0 && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )}

          {!loading && hasCustomer && policies.length === 0 && !error && (
            <div className="py-14 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {isStaff ? t('policies.noCustomerPolicies') : t('policies.noOwnPolicies')}
              </p>
            </div>
          )}

          {policies.length > 0 && (
            <PoliciesTable policies={policies} onRowClick={(id) => navigate(`/policies/${id}`)} />
          )}

          {nextLink && !loading && (
            <div className="py-1 px-4 text-center border-t">
              <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => fetchPolicies(nextLink)}>
                {t('policies.loadMore')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyPoliciesPage;
