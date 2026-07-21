import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useDateLocale } from '../hooks/useDateLocale';
import { listMyCases, cancelCase } from '../api/cases';
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
import { RefreshCw, Search, UserX, X, Trash2 } from 'lucide-react';
import { cn, fmtHours } from '@/lib/utils';
import { toast } from 'sonner';
import DataTable from '../components/DataTable';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIORITY_COLOR = {
  0: { key: 'priority.critical', color: '#DC2626', bg: '#FEF2F2' },
  1: { key: 'priority.high',     color: '#EA580C', bg: '#FFF7ED' },
  2: { key: 'priority.normal',   color: '#1B3860', bg: '#EFF6FF' },
  3: { key: 'priority.low',      color: '#16A34A', bg: '#F0FDF4' },
};
const PriorityBadge = ({ code }) => {
  const { t } = useTranslation();
  const p = PRIORITY_COLOR[code];
  if (!p) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span style={{ color: p.color, background: p.bg, borderRadius: 9999, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {t(p.key)}
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
const NotLinkedState = () => {
  const { t } = useTranslation();
  return (
    <div className="py-16 text-center space-y-3">
      <UserX className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <p className="font-medium text-sm">{t('myTickets.notLinkedTitle')}</p>
      <p className="text-muted-foreground text-xs max-w-xs mx-auto">
        {t('myTickets.notLinkedBody')}
      </p>
    </div>
  );
};

// ─── Barra de filtros ─────────────────────────────────────────────────────────
const FilterBar = ({ filters, onChange, onClear }) => {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState(filters.search       || '');
  const [ticketInput, setTicketInput] = useState(filters.ticketNumber || '');
  const hasActive = filters.search || filters.ticketNumber || filters.priority !== '';

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <form
        onSubmit={(e) => { e.preventDefault(); onChange('search', searchInput.trim()); }}
        className="flex gap-1.5"
      >
        <Input
          placeholder={t('cases.searchByTitle')}
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
          placeholder={t('cases.ticketNumberPlaceholder')}
          value={ticketInput}
          onChange={(e) => setTicketInput(e.target.value)}
          className="w-40 h-8 text-sm font-mono"
        />
        <Button type="submit" variant="secondary" size="sm" className="h-8 px-3">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </form>

      <Select
        value={filters.priority || 'all'}
        onValueChange={(v) => onChange('priority', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-36 h-8 text-sm">
          <SelectValue placeholder={t('table.priority')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('cases.allPriorities')}</SelectItem>
          <SelectItem value="0">{t('priority.critical')}</SelectItem>
          <SelectItem value="1">{t('priority.high')}</SelectItem>
          <SelectItem value="2">{t('priority.normal')}</SelectItem>
          <SelectItem value="3">{t('priority.low')}</SelectItem>
        </SelectContent>
      </Select>

      {hasActive && (
        <Button variant="ghost" size="sm" className="h-8 text-xs"
          onClick={() => { setSearchInput(''); setTicketInput(''); onClear(); }}>
          <X className="mr-1 h-3.5 w-3.5" /> {t('common.clear')}
        </Button>
      )}
    </div>
  );
};

// ─── Tabla de tickets ─────────────────────────────────────────────────────────
const MyTicketsTable = ({ cases, onRowClick, onDeleteClick }) => {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const columns = [
    { key: 'ticket', label: t('table.ticket'), width: 190, accessor: (c) => c.ticketnumber,
      render: (c) => <span className="text-sm font-bold">{c.ticketnumber}</span> },
    { key: 'title', label: t('table.title'), width: 220, accessor: (c) => c.title,
      render: (c) => <span className="font-medium line-clamp-2">{c.title}</span> },
    { key: 'etapa', label: t('table.stage'), width: 130, filterType: 'select',
      accessor: (c) => c.activeStage, render: (c) => <StageBadge name={c.activeStage} /> },
    { key: 'prioridad', label: t('table.priority'), width: 150, filterType: 'select',
      accessor: (c) => PRIORITY_COLOR[c.prioritycode] ? t(PRIORITY_COLOR[c.prioritycode].key) : null, render: (c) => <PriorityBadge code={c.prioritycode} /> },
    { key: 'responsable', label: t('table.owner'), width: 150, filterType: 'text',
      accessor: (c) => c.ownerName,
      render: (c) => <span className="text-muted-foreground whitespace-nowrap text-xs">{c.ownerName || '—'}</span> },
    { key: 'horas', label: t('table.hours'), width: 100, filterType: 'none',
      accessor: (c) => c.billableHours ?? 0,
      render: (c) => <span className="text-muted-foreground whitespace-nowrap text-xs">{c.billableHours ? `${fmtHours(c.billableHours)}h` : '—'}</span> },
    { key: 'creado', label: t('table.created'), width: 110, filterType: 'none',
      accessor: (c) => c.createdon ? new Date(c.createdon) : null,
      render: (c) => <span className="text-muted-foreground whitespace-nowrap text-xs">{c.createdon ? format(new Date(c.createdon), 'dd MMM yyyy', { locale: dateLocale }) : '—'}</span> },
    { key: 'accion', label: '', width: 60, sortable: false, filterType: 'none', accessor: () => null, className: 'text-right',
      render: (c) => (c.new_portal && c.statecode !== 2 ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => { e.stopPropagation(); onDeleteClick(c); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">{t('common.delete')}</span>
        </Button>
      ) : null) },
  ];

  return (
    <DataTable
      columns={columns}
      data={cases}
      getRowKey={(c) => c.incidentid}
      getRowTitle={(c) => c.cre2f_iswarranty ? t('cases.warrantyTicket') : undefined}
      getRowClassName={(c) => cn(c.cre2f_iswarranty ? 'bg-amber-50 hover:bg-amber-100 border-l-2 border-l-amber-400' : 'hover:bg-muted/30')}
      onRowClick={(c) => onRowClick(c.incidentid)}
      maxHeight="calc(100vh-320px)"
    />
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────
// Este menú solo muestra tickets activos — el estado ya no es un filtro editable.
const DEFAULT_FILTERS = { search: '', ticketNumber: '', priority: '' };

const MyTicketsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasCustomer = !!user?.d365ContactId;

  const [filters, setFilters]   = useState(DEFAULT_FILTERS);
  const [cases, setCases]       = useState([]);
  const [nextLink, setNextLink] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [deleting, setDeleting] = useState(null); // ticket a cancelar

  const fetchCases = useCallback(async (link = null) => {
    if (!hasCustomer) return;
    try {
      setLoading(true);
      setError('');
      const params = link
        ? { nextLink: link }
        : {
            statecode: 0, // solo tickets activos, fijo (no editable desde el filtro)
            ...(filters.priority   !== '' ? { priority:     filters.priority     } : {}),
            ...(filters.search           ? { search:        filters.search       } : {}),
            ...(filters.ticketNumber     ? { ticketNumber:  filters.ticketNumber } : {}),
          };
      const result = await listMyCases(params);
      setCases((prev) => (link ? [...prev, ...result.data] : result.data));
      setNextLink(result.nextLink);
    } catch (err) {
      setError(err.response?.data?.error || t('myTickets.loadError'));
    } finally {
      setLoading(false);
    }
  }, [hasCustomer, filters, t]);

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
      toast.success(t('myTickets.deletedToast', { ticket: deleting.ticketnumber }));
      setDeleting(null);
      fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.error || t('myTickets.deleteError'));
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Encabezado + filtros — sticky bajo el navbar ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b pb-3 pt-1 -mx-8 px-8 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
          <h1 className="text-xl font-semibold tracking-tight">{t('nav.myTickets')}</h1>
        </div>

        {hasCustomer && (
          <FilterBar
            filters={filters}
            onChange={handleFilterChange}
            onClear={() => setFilters(DEFAULT_FILTERS)}
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
              <p className="text-sm text-muted-foreground">{t('cases.noResults')}</p>
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
                {t('cases.loadMore')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación */}
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('myTickets.deleteDialogTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('myTickets.deleteDialogBody')}{' '}
            <span className="font-semibold text-foreground">{deleting?.ticketnumber}</span>?
            {' '}{t('myTickets.deleteDialogWarning')}
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

export default MyTicketsPage;
