import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
const fmtUSDate = (str) => {
  const date = parseUSDate(str);
  return date ? format(date, 'dd MMM yyyy', { locale: es }) : null;
};

// ─── Estado sin contacto/cuenta vinculada ─────────────────────────────────────
const NotLinkedState = () => (
  <div className="py-16 text-center space-y-3">
    <ShieldOff className="mx-auto h-10 w-10 text-muted-foreground/40" />
    <p className="font-medium text-sm">Tu cuenta no está vinculada a un contacto o empresa</p>
    <p className="text-muted-foreground text-xs max-w-xs mx-auto">
      Solicita al administrador que vincule tu usuario a un contacto o cuenta de Dynamics 365.
    </p>
  </div>
);

// ─── Estado: staff sin cliente seleccionado ───────────────────────────────────
const SelectClientState = () => (
  <div className="py-16 text-center space-y-3">
    <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
    <p className="font-medium text-sm">Selecciona un cliente</p>
    <p className="text-muted-foreground text-xs max-w-xs mx-auto">
      Elige un cliente en el filtro de arriba para ver sus pólizas.
    </p>
  </div>
);

// ─── Badge de estado ───────────────────────────────────────────────────────────
const PolicyStatusBadge = ({ statecode }) => {
  const active = statecode === 0;
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
      style={active
        ? { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }
        : { background: '#F4F4F5', color: '#71717A', border: '1px solid #E4E4E7' }}
    >
      {active ? 'Activa' : 'Inactiva'}
    </span>
  );
};

// ─── Tabla ─────────────────────────────────────────────────────────────────────
const PoliciesTable = ({ policies, onRowClick }) => {
  const columns = [
    { key: 'poliza', label: 'Póliza', width: 160, accessor: (p) => p.name,
      render: (p) => <span className="text-sm font-bold">{p.name}</span> },
    { key: 'inicio', label: 'Fecha inicio', width: 130, filterType: 'none',
      accessor: (p) => parseUSDate(p.startDateFormatted),
      render: (p) => <span className="text-muted-foreground whitespace-nowrap">{fmtUSDate(p.startDateFormatted) || '—'}</span> },
    { key: 'vencimiento', label: 'Fecha vencimiento', width: 150, filterType: 'none',
      accessor: (p) => parseUSDate(p.dueDateFormatted),
      render: (p) => <span className="text-muted-foreground whitespace-nowrap">{fmtUSDate(p.dueDateFormatted) || '—'}</span> },
    { key: 'precio', label: 'Precio unitario', width: 150, filterType: 'none',
      accessor: (p) => p.unitPrice,
      render: (p) => (
        <span className="whitespace-nowrap">
          {p.unitPrice != null ? `${p.unitPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${p.currency || ''}` : '—'}
        </span>
      ) },
    { key: 'horas', label: 'Total de horas', width: 130, filterType: 'none',
      accessor: (p) => p.totalHours,
      render: (p) => <span className="whitespace-nowrap">{p.totalHours != null ? `${p.totalHours} h` : '—'}</span> },
    { key: 'estado', label: 'Estado', width: 130, filterType: 'select',
      accessor: (p) => (p.statecode === 0 ? 'Activa' : 'Inactiva'),
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
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
      setError(err.response?.data?.error || 'Error al cargar las pólizas');
    } finally {
      setLoading(false);
    }
  }, [hasCustomer, isStaff, selectedClient]);

  useEffect(() => {
    setPolicies([]);
    setNextLink(null);
    fetchPolicies();
  }, [fetchPolicies]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{isStaff ? 'Pólizas' : 'Mis Pólizas'}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isStaff ? 'Pólizas por cliente' : 'Pólizas asociadas a tu cuenta'}
        </p>
      </div>

      {isStaff && clients.length > 0 && (
        <Select value={selectedClientId || 'none'} onValueChange={(v) => setSelectedClientId(v === 'none' ? '' : v)}>
          <SelectTrigger className="w-64 h-9 text-sm">
            <SelectValue placeholder="Selecciona un cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Selecciona un cliente</SelectItem>
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
                {isStaff ? 'Este cliente no tiene pólizas registradas.' : 'No tienes pólizas registradas.'}
              </p>
            </div>
          )}

          {policies.length > 0 && (
            <PoliciesTable policies={policies} onRowClick={(id) => navigate(`/policies/${id}`)} />
          )}

          {nextLink && !loading && (
            <div className="py-1 px-4 text-center border-t">
              <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => fetchPolicies(nextLink)}>
                Cargar más pólizas
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyPoliciesPage;
