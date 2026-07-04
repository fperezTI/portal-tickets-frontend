import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { listCases, getStages } from '../api/cases';
import { listUsers } from '../api/users';
import { resolveAccount, resolveContact } from '../api/d365';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import CaseStatusBadge from '../components/CaseStatusBadge';
import { RefreshCw, Search, UserX, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIORITY_COLOR = {
  0: { label: 'Crítica', color: '#DC2626', bg: '#FEF2F2' },
  1: { label: 'Alta',    color: '#EA580C', bg: '#FFF7ED' },
  2: { label: 'Normal',  color: '#1B3860', bg: '#EFF6FF' },
  3: { label: 'Baja',    color: '#16A34A', bg: '#F0FDF4' },
};
const PriorityBadge = ({ code }) => {
  const p = PRIORITY_COLOR[code];
  if (!p) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span style={{ color: p.color, background: p.bg, borderRadius: 9999, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {p.label}
    </span>
  );
};
const STAFF_ROLES = ['admin', 'support'];

const STAGE_PALETTE = ['#94A3B8', '#0EA5E9', '#EAB308', '#F97316', '#22C55E', '#1E3A8A'];
const STAGE_KEYWORD_COLOR = [
  { kw: 'approval',    color: '#94A3B8' },
  { kw: 'in progress', color: '#0EA5E9' },
  { kw: 'progress',    color: '#0EA5E9' },
  { kw: 'wait',        color: '#EAB308' },
  { kw: 'test',        color: '#F97316' },
  { kw: 'resolv',      color: '#22C55E' },
  { kw: 'clos',        color: '#1E3A8A' },
];
const stageColor = (name) => {
  if (!name) return '#94A3B8';
  const m = name.match(/^(\d+)/);
  if (m) return STAGE_PALETTE[parseInt(m[1]) - 1] ?? '#94A3B8';
  const lower = name.toLowerCase();
  return STAGE_KEYWORD_COLOR.find(({ kw }) => lower.includes(kw))?.color ?? '#94A3B8';
};
const StageBadge = ({ name }) => {
  if (!name) return <span className="text-muted-foreground text-xs">—</span>;
  const c = stageColor(name);
  return (
    <span style={{ color: c, border: `1px solid ${c}40`, background: `${c}18`, borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {name}
    </span>
  );
};

// ─── Estado sin contacto/cuenta vinculada ─────────────────────────────────────
const NotLinkedState = () => (
  <div className="py-16 text-center space-y-3">
    <UserX className="mx-auto h-10 w-10 text-muted-foreground/40" />
    <p className="font-medium text-sm">Tu cuenta no está vinculada a un contacto o empresa</p>
    <p className="text-muted-foreground text-xs max-w-xs mx-auto">
      Solicita al administrador que vincule tu usuario a un contacto o cuenta de Dynamics 365.
    </p>
  </div>
);

// ─── Filtro de contacto para staff ───────────────────────────────────────────
const ContactFilter = ({ value, onSearch }) => {
  const [input, setInput] = useState(value || '');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSearch(input.trim()); }} className="flex gap-2">
      <Input
        placeholder="ID de contacto o cuenta en D365 (GUID)…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-80 font-mono text-xs"
      />
      <Button type="submit" variant="secondary" size="sm">
        <Search className="mr-2 h-4 w-4" /> Buscar
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm"
          onClick={() => { setInput(''); onSearch(''); }}>
          Limpiar
        </Button>
      )}
    </form>
  );
};

// ─── Barra de filtros ─────────────────────────────────────────────────────────
const FilterBar = ({ filters, onChange, onClear, stages = [], clients = [], isStaff = false }) => {
  const [searchInput,  setSearchInput]  = useState(filters.search       || '');
  const [ticketInput,  setTicketInput]  = useState(filters.ticketNumber || '');
  const hasActive = filters.search || filters.ticketNumber || filters.statecode !== '' || filters.priority !== '' || filters.stage !== '' || filters.clientId !== '';

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <form
        onSubmit={(e) => { e.preventDefault(); onChange('search', searchInput.trim()); }}
        className="flex gap-1.5"
      >
        <Input
          placeholder="Buscar por título…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-48 h-8 text-sm"
        />
        <Button type="submit" variant="secondary" size="sm" className="h-8 px-3">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </form>

      <form
        onSubmit={(e) => { e.preventDefault(); onChange('ticketNumber', ticketInput.trim()); }}
        className="flex gap-1.5"
      >
        <Input
          placeholder="No. de ticket…"
          value={ticketInput}
          onChange={(e) => setTicketInput(e.target.value)}
          className="w-40 h-8 text-sm font-mono"
        />
        <Button type="submit" variant="secondary" size="sm" className="h-8 px-3">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </form>

      {isStaff && clients.length > 0 && (
        <Select
          value={filters.clientId || 'all'}
          onValueChange={(v) => onChange('clientId', v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={filters.statecode || 'all'}
        onValueChange={(v) => onChange('statecode', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-36 h-8 text-sm">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="0">Activo</SelectItem>
          <SelectItem value="1">Resuelto</SelectItem>
          <SelectItem value="2">Cancelado</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.priority || 'all'}
        onValueChange={(v) => onChange('priority', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-36 h-8 text-sm">
          <SelectValue placeholder="Prioridad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las prioridades</SelectItem>
          <SelectItem value="0">Crítica</SelectItem>
          <SelectItem value="1">Alta</SelectItem>
          <SelectItem value="2">Normal</SelectItem>
          <SelectItem value="3">Baja</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.stage || 'all'}
        onValueChange={(v) => onChange('stage', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-36 h-8 text-sm">
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las etapas</SelectItem>
          {stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      {hasActive && (
        <Button variant="ghost" size="sm" className="h-8 text-xs"
          onClick={() => { setSearchInput(''); setTicketInput(''); onClear(); }}>
          <X className="mr-1 h-3.5 w-3.5" /> Limpiar
        </Button>
      )}
    </div>
  );
};

// ─── Tabla de tickets ─────────────────────────────────────────────────────────
const COLS_CLIENT = ['Ticket', 'Título', 'Etapa', 'Prioridad', 'Contacto', 'Estado', 'Responsable', 'Creado'];
const COLS_STAFF  = ['Ticket', 'Título', 'Cliente', 'Etapa', 'Prioridad', 'Contacto', 'Estado', 'Responsable', 'Creado'];

const CasesTable = ({ cases, onRowClick, showCustomer = false }) => {
  const cols = showCustomer ? COLS_STAFF : COLS_CLIENT;
  return (
    <div className="overflow-y-auto max-h-[calc(100vh-320px)]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur border-b">
          <tr>
            {cols.map((h) => (
              <th key={h}
                className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap first:pl-6">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {cases.map((c) => (
            <tr
              key={c.incidentid}
              className={cn(
                'cursor-pointer transition-colors',
                c.cre2f_iswarranty ? 'bg-amber-50 hover:bg-amber-100 border-l-2 border-l-amber-400' : 'hover:bg-muted/30'
              )}
              title={c.cre2f_iswarranty ? 'Ticket de garantía' : undefined}
              onClick={() => onRowClick(c.incidentid)}
            >
              <td className="pl-6 pr-4 py-3 text-sm font-bold whitespace-nowrap w-[130px] max-w-[130px] truncate">
                {c.ticketnumber}
              </td>
              <td className="px-4 py-3 font-medium max-w-[200px]">
                <span className="line-clamp-2">{c.title}</span>
              </td>
              {showCustomer && (
                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap max-w-[150px] truncate">
                  {c.customerName || '—'}
                </td>
              )}
              <td className="px-4 py-3 whitespace-nowrap">
                <StageBadge name={c.activeStage} />
              </td>
              <td className="px-4 py-3">
                <PriorityBadge code={c.prioritycode} />
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap max-w-[140px] truncate">
                {c.contactName || '—'}
              </td>
              <td className="px-4 py-3">
                <CaseStatusBadge statecode={c.statecode} />
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs max-w-[140px] truncate">
                {c.ownerName || '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                {c.createdon ? format(new Date(c.createdon), 'dd MMM yyyy', { locale: es }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────
const DEFAULT_FILTERS = { search: '', ticketNumber: '', statecode: '', priority: '', stage: '', clientId: '' };

const CasesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff  = STAFF_ROLES.includes(user?.role);

  const [filters, setFilters]   = useState(DEFAULT_FILTERS);
  const [stages, setStages]     = useState([]);
  const [clients, setClients]   = useState([]);
  const [cases, setCases]       = useState([]);
  const [nextLink, setNextLink] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [customerLabel, setCustomerLabel] = useState(user?.fullName || user?.email || '');

  const effectiveContactId = isStaff ? null : (user?.d365ContactId || user?.d365AccountId || '');
  const hasCustomer = isStaff || !!effectiveContactId;

  useEffect(() => {
    getStages().then(setStages).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    listUsers({ pageSize: 200 })
      .then((r) => setClients(r.data.filter((u) => u.role === 'client' && (u.d365ContactId || u.d365AccountId))))
      .catch(() => {});
  }, [isStaff]);

  useEffect(() => {
    if (isStaff) return;
    if (user?.d365AccountId) {
      resolveAccount(user.d365AccountId)
        .then((a) => setCustomerLabel(a.name || user?.fullName || user?.email || ''))
        .catch(() => {});
    } else if (user?.d365ContactId) {
      resolveContact(user.d365ContactId)
        .then((c) => setCustomerLabel(c.name || user?.fullName || user?.email || ''))
        .catch(() => {});
    }
  }, [user?.d365AccountId, user?.d365ContactId, isStaff]);

  const fetchCases = useCallback(async (link = null) => {
    if (!isStaff && !effectiveContactId) return;
    try {
      setLoading(true);
      setError('');
      const selectedClient = clients.find((c) => c.id === filters.clientId);
      const params = link
        ? { nextLink: link }
        : {
            ...(isStaff && selectedClient?.d365ContactId ? { contactId: selectedClient.d365ContactId } : {}),
            ...(isStaff && selectedClient?.d365AccountId ? { accountId: selectedClient.d365AccountId } : {}),
            ...(filters.statecode  !== '' ? { statecode:    filters.statecode    } : {}),
            ...(filters.priority   !== '' ? { priority:     filters.priority     } : {}),
            ...(filters.search           ? { search:        filters.search       } : {}),
            ...(filters.ticketNumber     ? { ticketNumber:  filters.ticketNumber } : {}),
            ...(filters.stage            ? { stage:         filters.stage        } : {}),
          };
      const result = await listCases(params);
      setCases((prev) => (link ? [...prev, ...result.data] : result.data));
      setNextLink(result.nextLink);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar los tickets');
    } finally {
      setLoading(false);
    }
  }, [isStaff, effectiveContactId, clients, filters]);

  useEffect(() => {
    setCases([]);
    setNextLink(null);
    setError('');
    fetchCases();
  }, [filters]);

  const handleFilterChange = (key, val) => setFilters((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-4">
      {/* ── Encabezado + filtros — sticky bajo el navbar ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b pb-3 pt-1 -mx-8 px-8 space-y-3">
        {/* Fila de título */}
        <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {isStaff
              ? 'Todos los tickets'
              : <>Tickets de <span className="text-primary">{customerLabel}</span></>}
          </h1>
        </div>

        {/* Filtros de contenido */}
        {hasCustomer && (
          <FilterBar
            filters={filters}
            onChange={handleFilterChange}
            onClear={() => setFilters(DEFAULT_FILTERS)}
            stages={stages}
            clients={clients}
            isStaff={isStaff}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={() => fetchCases()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {/* Sin contacto vinculado (solo clientes) */}
          {!isStaff && !hasCustomer && <NotLinkedState />}

          {/* Skeleton */}
          {loading && cases.length === 0 && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )}

          {/* Sin resultados */}
          {!loading && hasCustomer && cases.length === 0 && !error && (
            <div className="py-14 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No hay tickets con los filtros aplicados.</p>
            </div>
          )}

          {/* Tabla */}
          {cases.length > 0 && (
            <CasesTable
              cases={cases}
              onRowClick={(id) => navigate(`/cases/${id}`)}
              showCustomer={isStaff}
            />
          )}

          {/* Cargar más */}
          {nextLink && !loading && (
            <div className="py-1 px-4 text-center border-t">
              <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => fetchCases(nextLink)}>
                Cargar más tickets
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CasesPage;
