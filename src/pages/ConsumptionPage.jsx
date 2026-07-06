import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { getConsumption, listConsumptionCustomers } from '../api/consumption';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, BarChart3, Users, ShieldCheck } from 'lucide-react';
import { fmtHours as fmtHoursShared, cn } from '@/lib/utils';

const STAFF_ROLES = ['admin', 'support'];
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// Mismo criterio de orden de etapas que ya usa el dashboard (por palabra clave).
const STAGE_ORDER = ['approval', 'progress', 'test', 'wait', 'resolv', 'clos'];
const stageOrder = (name) => {
  if (!name) return STAGE_ORDER.length;
  const idx = STAGE_ORDER.findIndex((kw) => name.toLowerCase().includes(kw));
  return idx === -1 ? STAGE_ORDER.length : idx;
};

const fmtHours = (h) => (h ? fmtHoursShared(h) : '');

const ConsumptionPage = () => {
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [year, setYear] = useState(CURRENT_YEAR);
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
      setError(err.response?.data?.error || 'Error al cargar el consumo');
    } finally {
      setLoading(false);
    }
  }, [hasCustomer, isStaff, selectedClient, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.stage)) map.set(r.stage, []);
      map.get(r.stage).push(r);
    });
    return [...map.entries()]
      .map(([stage, items]) => ({
        stage,
        items,
        monthTotals: Array.from({ length: 12 }, (_, i) =>
          Math.round(items.reduce((s, r) => s + (r.months[i + 1] ?? 0), 0) * 100) / 100),
        total: Math.round(items.reduce((s, r) => s + r.total, 0) * 100) / 100,
      }))
      .sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage));
  }, [rows]);

  const grandMonthTotals = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => Math.round(groups.reduce((s, g) => s + g.monthTotals[i], 0) * 100) / 100),
  [groups]);
  const grandTotal = useMemo(() => Math.round(groups.reduce((s, g) => s + g.total, 0) * 100) / 100, [groups]);

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
            <BarChart3 className="h-5 w-5 text-primary" /> Consumo
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Horas aplicadas por ticket, desglosadas por mes</p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && clients.length > 0 && (
            <Select value={selectedClientId || 'none'} onValueChange={(v) => setSelectedClientId(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-56 h-9 text-sm">
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

      <Card>
        <CardContent className="p-0">
          {isStaff && !hasCustomer && (
            <div className="py-16 text-center space-y-3">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-sm">Selecciona un cliente</p>
              <p className="text-muted-foreground text-xs max-w-xs mx-auto">
                Elige un cliente arriba para ver su consumo de horas billables.
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
              No hay consumo de horas billables registrado en {year}.
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 border-y sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-muted/60 z-20">Ticket</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap min-w-[220px]">Título</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{m}</th>
                    ))}
                    <th className="text-right px-4 py-2.5 font-bold text-foreground whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groups.map((g) => {
                    const collapsed = collapsedGroups.has(g.stage);
                    return (
                      <Fragment key={g.stage}>
                        <tr className="bg-muted/30 hover:bg-muted/40 cursor-pointer transition-colors" onClick={() => toggleGroup(g.stage)}>
                          <td colSpan={2} className="px-4 py-2 font-semibold sticky left-0 bg-muted/30 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                              {g.stage} <span className="text-xs font-normal text-muted-foreground">({g.items.length})</span>
                            </span>
                          </td>
                          {g.monthTotals.map((h, i) => (
                            <td key={i} className="px-3 py-2 text-right font-semibold whitespace-nowrap">{fmtHours(h)}</td>
                          ))}
                          <td className="px-4 py-2 text-right font-bold whitespace-nowrap">{fmtHours(g.total)}</td>
                        </tr>
                        {!collapsed && g.items.map((r) => (
                          <tr
                            key={r.ticketId}
                            className={cn('transition-colors', r.isWarranty ? 'bg-amber-50 hover:bg-amber-100 border-l-2 border-l-amber-400' : 'hover:bg-muted/10')}
                            title={r.isWarranty ? 'Ticket de garantía — no cuenta como horas billables' : undefined}
                          >
                            <td className={cn('pl-8 pr-4 py-2 text-sm font-bold whitespace-nowrap sticky left-0', r.isWarranty ? 'bg-amber-50' : 'bg-background')}>
                              <span className="inline-flex items-center gap-1.5">
                                {r.ticketNumber}
                                {r.isWarranty && <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground truncate max-w-[280px]" title={r.title}>{r.title}</td>
                            {Array.from({ length: 12 }, (_, i) => r.months[i + 1] ?? 0).map((h, i) => (
                              <td key={i} className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{fmtHours(h)}</td>
                            ))}
                            <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">{r.isWarranty ? '0.0' : fmtHours(r.total)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan={2} className="px-4 py-2.5 sticky left-0 bg-background whitespace-nowrap">Total</td>
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
