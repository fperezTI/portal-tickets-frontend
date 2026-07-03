import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { listMyCases, getStages, cancelCase } from '../api/cases';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import CaseStatusBadge from '../components/CaseStatusBadge';
import { RefreshCw, Search, UserX, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

// ─── Estado sin contacto vinculado ─────────────────────────────────────────────
const NotLinkedState = () => (
  <div className="py-16 text-center space-y-3">
    <UserX className="mx-auto h-10 w-10 text-muted-foreground/40" />
    <p className="font-medium text-sm">Tu cuenta no está vinculada a un contacto</p>
    <p className="text-muted-foreground text-xs max-w-xs mx-auto">
      Solicita al administrador que vincule tu usuario a un contacto de Dynamics 365.
    </p>
  </div>
);

// ─── Barra de filtros ─────────────────────────────────────────────────────────
const FilterBar = ({ filters, onChange, onClear, stages = [] }) => {
  const [searchInput, setSearchInput] = useState(filters.search       || '');
  const [ticketInput, setTicketInput] = useState(filters.ticketNumber || '');
  const hasActive = filters.search || filters.ticketNumber || filters.statecode !== '0' || filters.priority !== '' || filters.stage !== '';

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
const COLS = ['Ticket', 'Título', 'Etapa', 'Prioridad', 'Estado', 'Responsable', 'Creado', ''];

const MyTicketsTable = ({ cases, onRowClick, onDeleteClick }) => (
  <div className="overflow-y-auto max-h-[calc(100vh-320px)]">
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur border-b">
        <tr>
          {COLS.map((h) => (
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
            <td className="pl-6 pr-4 py-3 text-sm font-bold whitespace-nowrap">
              {c.ticketnumber}
            </td>
            <td className="px-4 py-3 font-medium max-w-[200px]">
              <span className="line-clamp-2">{c.title}</span>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <StageBadge name={c.activeStage} />
            </td>
            <td className="px-4 py-3">
              <PriorityBadge code={c.prioritycode} />
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
            <td className="px-4 py-3 text-right">
              {c.new_portal && c.statecode !== 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); onDeleteClick(c); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Eliminar</span>
                </Button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Página principal ─────────────────────────────────────────────────────────
const DEFAULT_FILTERS = { search: '', ticketNumber: '', statecode: '0', priority: '', stage: '' };

const MyTicketsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasCustomer = !!user?.d365ContactId;

  const [filters, setFilters]   = useState(DEFAULT_FILTERS);
  const [stages, setStages]     = useState([]);
  const [cases, setCases]       = useState([]);
  const [nextLink, setNextLink] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [deleting, setDeleting] = useState(null); // ticket a cancelar

  useEffect(() => {
    getStages().then(setStages).catch(() => {});
  }, []);

  const fetchCases = useCallback(async (link = null) => {
    if (!hasCustomer) return;
    try {
      setLoading(true);
      setError('');
      const params = link
        ? { nextLink: link }
        : {
            ...(filters.statecode  !== '' ? { statecode:    filters.statecode    } : {}),
            ...(filters.priority   !== '' ? { priority:     filters.priority     } : {}),
            ...(filters.search           ? { search:        filters.search       } : {}),
            ...(filters.ticketNumber     ? { ticketNumber:  filters.ticketNumber } : {}),
            ...(filters.stage            ? { stage:         filters.stage        } : {}),
          };
      const result = await listMyCases(params);
      setCases((prev) => (link ? [...prev, ...result.data] : result.data));
      setNextLink(result.nextLink);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar tus tickets');
    } finally {
      setLoading(false);
    }
  }, [hasCustomer, filters]);

  useEffect(() => {
    setCases([]);
    setNextLink(null);
    setError('');
    fetchCases();
  }, [filters]);

  const handleFilterChange = (key, val) => setFilters((prev) => ({ ...prev, [key]: val }));

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await cancelCase(deleting.incidentid);
      toast.success(`Ticket ${deleting.ticketnumber} eliminado`);
      setDeleting(null);
      fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar el ticket');
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Encabezado + filtros — sticky bajo el navbar ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b pb-3 pt-1 -mx-8 px-8 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
          <h1 className="text-xl font-semibold tracking-tight">Mis Tickets</h1>
        </div>

        {hasCustomer && (
          <FilterBar
            filters={filters}
            onChange={handleFilterChange}
            onClear={() => setFilters(DEFAULT_FILTERS)}
            stages={stages}
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
          {!hasCustomer && <NotLinkedState />}

          {loading && cases.length === 0 && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )}

          {!loading && hasCustomer && cases.length === 0 && !error && (
            <div className="py-14 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No hay tickets con los filtros aplicados.</p>
            </div>
          )}

          {cases.length > 0 && (
            <MyTicketsTable
              cases={cases}
              onRowClick={(id) => navigate(`/cases/${id}`)}
              onDeleteClick={setDeleting}
            />
          )}

          {nextLink && !loading && (
            <div className="py-1 px-4 text-center border-t">
              <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => fetchCases(nextLink)}>
                Cargar más tickets
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación */}
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar ticket</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            ¿Estás seguro de que deseas eliminar el ticket{' '}
            <span className="font-semibold text-foreground">{deleting?.ticketnumber}</span>?
            Esta acción cancela el ticket y no se puede deshacer.
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

export default MyTicketsPage;
