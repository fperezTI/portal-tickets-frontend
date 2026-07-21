import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getConsumption, listConsumptionCustomers } from '../api/consumption';
import { listMyPolicies } from '../api/policies';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown, ChevronUp, BarChart3, Users, ShieldCheck, Clock, Ticket, TrendingUp, Wallet,
} from 'lucide-react';
import { fmtHours as fmtHoursShared, cn } from '@/lib/utils';

const STAFF_ROLES = ['admin', 'support'];
const MONTH_SHORT_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// Mismo criterio de color/orden de etapas que ya usa el resto de la app.
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
const STAGE_ORDER = ['approval', 'progress', 'test', 'wait', 'resolv', 'clos'];
const stageOrder = (name) => {
  if (!name) return STAGE_ORDER.length;
  const idx = STAGE_ORDER.findIndex((kw) => name.toLowerCase().includes(kw));
  return idx === -1 ? STAGE_ORDER.length : idx;
};

const fmtHours = (h) => (h ? fmtHoursShared(h) : '');

// ─── Tarjeta KPI (mismo estilo que el Panel de indicadores) ───────────────────
const KpiCard = ({ icon: Icon, value, label, iconBg = 'bg-muted', iconColor = 'text-muted-foreground', valueColor = 'text-foreground' }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
          <p className={`text-3xl font-bold mt-1.5 tabular-nums ${valueColor}`}>
            {value ?? <span className="text-xl text-muted-foreground">—</span>}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl shrink-0 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const ConsumptionPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);

  const MONTHS = useMemo(() => MONTH_SHORT_KEYS.map((k) => t(`months.short.${k}`)), [t]);
  const MONTH_FULL = useMemo(() => MONTH_SHORT_KEYS.map((k) => t(`months.full.${k}`)), [t]);

  // Los filtros viven en la URL (?client=&year=&month=) para que, al abrir un
  // ticket y volver, se regrese exactamente a la misma vista de Consumo.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClientId = searchParams.get('client') || '';
  const year = parseInt(searchParams.get('year') || String(CURRENT_YEAR));
  const selectedMonth = parseInt(searchParams.get('month') || '0');

  const setSelectedClientId = (id) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (id) next.set('client', id); else next.delete('client');
    return next;
  }, { replace: true });
  const setYear = (y) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('year', String(y));
    return next;
  }, { replace: true });
  const setSelectedMonth = (m) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('month', String(m));
    return next;
  }, { replace: true });

  const [clients, setClients] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  useEffect(() => {
    if (!isStaff) return;
    listConsumptionCustomers().then(setClients).catch(() => {});
  }, [isStaff]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const hasCustomer = isStaff ? !!selectedClient : true;

  const fetchData = useCallback(async () => {
    if (!hasCustomer) { setRows([]); return; }
    try {
      setLoading(true);
      setError('');
      const params = {
        year,
        ...(isStaff && selectedClient?.type === 'contact' ? { contactId: selectedClient.id } : {}),
        ...(isStaff && selectedClient?.type === 'account' ? { accountId: selectedClient.id } : {}),
      };
      const result = await getConsumption(params);
      setRows(result.rows || []);
    } catch (err) {
      setError(err.response?.data?.error || t('consumption.loadError'));
    } finally {
      setLoading(false);
    }
  }, [hasCustomer, isStaff, selectedClient, year, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Horas disponibles de las pólizas ACTIVAS del cliente — independiente del
  // filtro de año/mes, refleja el estado actual de sus pólizas.
  const [policies, setPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);

  const fetchPolicies = useCallback(async () => {
    if (!hasCustomer) { setPolicies([]); return; }
    try {
      setPoliciesLoading(true);
      const params = {
        pageSize: 100,
        ...(isStaff && selectedClient?.type === 'contact' ? { contactId: selectedClient.id } : {}),
        ...(isStaff && selectedClient?.type === 'account' ? { accountId: selectedClient.id } : {}),
      };
      const result = await listMyPolicies(params);
      setPolicies(result.data || []);
    } catch {
      setPolicies([]);
    } finally {
      setPoliciesLoading(false);
    }
  }, [hasCustomer, isStaff, selectedClient]);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const availableHours = useMemo(() => Math.round(
    policies
      .filter((p) => p.statecode === 0)
      .reduce((sum, p) => sum + ((p.totalHours ?? 0) - (p.consumedHours ?? 0)), 0) * 100
  ) / 100, [policies]);

  // Índices de mes (1-12) visibles según el filtro: todos, o solo el elegido.
  const visibleMonths = useMemo(() =>
    selectedMonth === 0 ? Array.from({ length: 12 }, (_, i) => i + 1) : [selectedMonth],
  [selectedMonth]);

  // Con un mes específico elegido, solo se muestran los tickets que tuvieron
  // horas ese mes (si no, la tabla quedaría llena de filas en cero). Los de
  // garantía se filtran por sus horas reales (rawMonths), ya que "months" se
  // anula siempre a 0 para que no cuenten en las sumas.
  const filteredRows = useMemo(() => {
    if (selectedMonth === 0) return rows;
    return rows.filter((r) => {
      const hours = r.isWarranty ? (r.rawMonths?.[selectedMonth] ?? 0) : (r.months[selectedMonth] ?? 0);
      return hours > 0;
    });
  }, [rows, selectedMonth]);

  const groups = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((r) => {
      if (!map.has(r.stage)) map.set(r.stage, []);
      map.get(r.stage).push(r);
    });
    return [...map.entries()]
      .map(([stage, items]) => {
        const monthTotals = visibleMonths.map((m) =>
          Math.round(items.reduce((s, r) => s + (r.months[m] ?? 0), 0) * 100) / 100);
        return {
          stage,
          items,
          monthTotals,
          // Suma de los meses visibles (no el total anual completo del ticket),
          // para que coincida con el filtro de mes activo.
          total: Math.round(monthTotals.reduce((s, h) => s + h, 0) * 100) / 100,
        };
      })
      .sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage));
  }, [filteredRows, visibleMonths]);

  const grandMonthTotals = useMemo(() =>
    visibleMonths.map((_, i) => Math.round(groups.reduce((s, g) => s + g.monthTotals[i], 0) * 100) / 100),
  [groups, visibleMonths]);
  const grandTotal = useMemo(() => Math.round(groups.reduce((s, g) => s + g.total, 0) * 100) / 100, [groups]);

  const kpis = useMemo(() => {
    const billableRows = filteredRows.filter((r) => !r.isWarranty);
    // Horas de garantía acotadas a los meses visibles (no el total anual
    // completo del ticket), para que coincida con el filtro de mes activo.
    const warrantyHours = Math.round(filteredRows.reduce((s, r) => {
      if (!r.isWarranty) return s;
      return s + visibleMonths.reduce((ms, m) => ms + (r.rawMonths?.[m] ?? 0), 0);
    }, 0) * 100) / 100;
    const avgPerTicket = billableRows.length > 0 ? Math.round((grandTotal / billableRows.length) * 100) / 100 : 0;
    return { ticketCount: filteredRows.length, warrantyHours, avgPerTicket };
  }, [filteredRows, grandTotal, visibleMonths]);

  const toggleGroup = (stage) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(stage)) next.delete(stage); else next.add(stage);
    return next;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> {t('nav.consumption')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('consumption.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && clients.length > 0 && (
            <Select value={selectedClientId || 'none'} onValueChange={(v) => setSelectedClientId(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-56 h-9 text-sm">
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
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t('consumption.allMonths')}</SelectItem>
              {MONTH_FULL.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-28 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}

      {hasCustomer && (
        loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              icon={Clock}
              value={fmtHoursShared(grandTotal)}
              label={selectedMonth === 0 ? t('consumption.billableHoursYear', { year }) : t('consumption.billableHoursMonth', { month: MONTH_FULL[selectedMonth - 1] })}
              iconBg="bg-primary/10"
              iconColor="text-primary"
              valueColor="text-primary"
            />
            <KpiCard
              icon={Ticket}
              value={kpis.ticketCount}
              label={t('consumption.ticketsWithConsumption')}
              iconBg="bg-blue-50"
              iconColor="text-blue-900"
              valueColor="text-blue-900"
            />
            <KpiCard
              icon={ShieldCheck}
              value={fmtHoursShared(kpis.warrantyHours)}
              label={t('consumption.warrantyHours')}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              valueColor="text-amber-600"
            />
            <KpiCard
              icon={TrendingUp}
              value={fmtHoursShared(kpis.avgPerTicket)}
              label={t('consumption.avgHoursPerTicket')}
              iconBg="bg-green-50"
              iconColor="text-green-600"
              valueColor="text-green-600"
            />
            <KpiCard
              icon={Wallet}
              value={policiesLoading ? undefined : fmtHoursShared(availableHours)}
              label={t('consumption.availableHoursActivePolicy')}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-600"
              valueColor="text-indigo-600"
            />
          </div>
        )
      )}

      <Card>
        <CardContent className="p-0">
          {isStaff && !hasCustomer && (
            <div className="py-16 text-center space-y-3">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-sm">{t('policies.selectClient')}</p>
              <p className="text-muted-foreground text-xs max-w-xs mx-auto">
                {t('consumption.selectClientBody')}
              </p>
            </div>
          )}

          {loading && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {!loading && hasCustomer && groups.length === 0 && !error && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {t('consumption.noConsumption', { period: selectedMonth === 0 ? String(year) : `${MONTH_FULL[selectedMonth - 1]} ${year}` })}
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 border-y sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-muted/60 z-20">{t('table.ticket')}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap min-w-[220px]">{t('table.title')}</th>
                    {visibleMonths.map((m) => (
                      <th key={m} className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{MONTHS[m - 1]}</th>
                    ))}
                    <th className="text-right px-4 py-2.5 font-bold text-foreground whitespace-nowrap">{t('consumption.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groups.map((g) => {
                    const collapsed = collapsedGroups.has(g.stage);
                    const color = stageColor(g.stage);
                    return (
                      <Fragment key={g.stage}>
                        <tr
                          className="bg-muted/30 hover:bg-muted/40 cursor-pointer transition-colors"
                          style={{ borderLeft: `3px solid ${color}` }}
                          onClick={() => toggleGroup(g.stage)}
                        >
                          <td colSpan={2} className="px-4 py-2 font-semibold sticky left-0 bg-muted/30 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                              <span style={{ color }}>{g.stage}</span>
                              <span className="text-xs font-normal text-muted-foreground">({g.items.length})</span>
                            </span>
                          </td>
                          {g.monthTotals.map((h, i) => (
                            <td key={i} className="px-3 py-2 text-right font-semibold whitespace-nowrap">{fmtHours(h)}</td>
                          ))}
                          <td className="px-4 py-2 text-right font-bold whitespace-nowrap">{fmtHours(g.total)}</td>
                        </tr>
                        {!collapsed && g.items.map((r) => {
                          const rowTotal = Math.round(visibleMonths.reduce((s, m) => s + (r.months[m] ?? 0), 0) * 100) / 100;
                          return (
                            <tr
                              key={r.ticketId}
                              className={cn('transition-colors cursor-pointer', r.isWarranty ? 'bg-amber-50 hover:bg-amber-100 border-l-2 border-l-amber-400' : 'hover:bg-muted/10')}
                              title={r.isWarranty ? t('consumption.warrantyRowTitle') : t('consumption.doubleClickToOpen')}
                              onDoubleClick={() => navigate(`/cases/${r.ticketId}`)}
                            >
                              <td className={cn('pl-8 pr-4 py-2 text-sm font-bold whitespace-nowrap sticky left-0', r.isWarranty ? 'bg-amber-50' : 'bg-background')}>
                                <span className="inline-flex items-center gap-1.5">
                                  {r.ticketNumber}
                                  {r.isWarranty && <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-muted-foreground truncate max-w-[280px]" title={r.title}>{r.title}</td>
                              {visibleMonths.map((m) => (
                                <td
                                  key={m}
                                  className={cn('px-3 py-2 text-right whitespace-nowrap', r.isWarranty ? 'text-red-600 font-medium' : 'text-muted-foreground')}
                                  title={r.isWarranty ? t('consumption.warrantyHoursCellTitle') : undefined}
                                >
                                  {r.isWarranty ? fmtHours(r.rawMonths?.[m] ?? 0) : fmtHours(r.months[m] ?? 0)}
                                </td>
                              ))}
                              <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">{r.isWarranty ? '0.0' : fmtHours(rowTotal)}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan={2} className="px-4 py-2.5 sticky left-0 bg-background whitespace-nowrap">{t('consumption.total')}</td>
                    {grandMonthTotals.map((h, i) => (
                      <td key={i} className="px-3 py-2.5 text-right whitespace-nowrap">{fmtHours(h)}</td>
                    ))}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtHours(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsumptionPage;
