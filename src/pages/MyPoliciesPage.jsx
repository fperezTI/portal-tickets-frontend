import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useDateLocale } from '../hooks/useDateLocale';
import { listMyPolicies, listPolicyCustomers, getPolicyHoursByMonth } from '../api/policies';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RefreshCw, ShieldOff, Users, CalendarRange, ChevronDown, ChevronRight } from 'lucide-react';
import DataTable from '../components/DataTable';
import { fmtHours } from '@/lib/utils';

// Orden preferido de los grupos de Tipo de Soporte en el panel de horas por
// cliente y mes; cualquier tipo no listado (o sin tipo asignado) cae al final.
const SUPPORT_TYPE_ORDER = ['Póliza', 'Consumo', 'Cierre', 'Ajuste', 'Bolsa'];
const supportTypeRank = (name) => {
  const idx = SUPPORT_TYPE_ORDER.indexOf(name);
  return idx === -1 ? SUPPORT_TYPE_ORDER.length : idx;
};

const STAFF_ROLES = ['admin', 'support'];
const MONTH_SHORT_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

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

// ─── Horas de póliza por cliente y mes (solo admin) ───────────────────────────
const PolicyHoursByMonthPanel = () => {
  const { t } = useTranslation();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const monthLabels = useMemo(() => MONTH_SHORT_KEYS.map((k) => t(`months.short.${k}`)), [t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getPolicyHoursByMonth(year)
      .then((res) => { if (!cancelled) setRows(res?.rows || []); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || t('policies.hoursByMonthError')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, t]);

  // Los grupos por Tipo de Soporte arrancan contraídos — se expanden solo al
  // hacer clic. Se recalcula cada vez que llegan datos nuevos (año).
  useEffect(() => {
    setCollapsedGroups(new Set(rows.map((r) => r.supportType || '__none__')));
  }, [rows]);

  const grandTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    rows.forEach((r) => r.months.forEach((h, i) => { totals[i] = Math.round((totals[i] + h) * 100) / 100; }));
    const total = Math.round(totals.reduce((s, h) => s + h, 0) * 100) / 100;
    return { totals, total };
  }, [rows]);

  // Un nivel de agrupación por Tipo de Soporte (cre2f_SupportType de la
  // cuenta) arriba de los clientes — mismo patrón visual que las etapas en
  // Consumo. Clientes sin tipo asignado (o que son contacto, no cuenta) caen
  // en un grupo "Sin tipo" al final.
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r.supportType || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return [...map.entries()]
      .map(([key, items]) => {
        const monthTotals = Array(12).fill(0);
        items.forEach((r) => r.months.forEach((h, i) => { monthTotals[i] = Math.round((monthTotals[i] + h) * 100) / 100; }));
        return {
          key,
          label: key === '__none__' ? t('policies.hoursByMonthNoType') : key,
          items,
          monthTotals,
          total: Math.round(monthTotals.reduce((s, h) => s + h, 0) * 100) / 100,
        };
      })
      .sort((a, b) => {
        if (a.key === '__none__') return 1;
        if (b.key === '__none__') return -1;
        return supportTypeRank(a.key) - supportTypeRank(b.key) || a.label.localeCompare(b.label);
      });
  }, [rows, t]);

  const toggleGroup = (key) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            {t('policies.hoursByMonthTitle')}
          </CardTitle>
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
        <p className="text-sm text-muted-foreground mt-0.5">{t('policies.hoursByMonthSubtitle')}</p>
      </CardHeader>
      <CardContent className="p-0">
        {error && (
          <div className="px-6 pb-4">
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          </div>
        )}

        {loading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="py-14 text-center text-sm text-muted-foreground">
            {t('policies.hoursByMonthEmpty', { year })}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 border-y">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-muted/60">{t('policies.hoursByMonthClient')}</th>
                  {monthLabels.map((m) => (
                    <th key={m} className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{m}</th>
                  ))}
                  <th className="text-right px-4 py-2.5 font-bold text-foreground whitespace-nowrap">{t('consumption.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {groups.map((g) => {
                  const collapsed = collapsedGroups.has(g.key);
                  return (
                    <Fragment key={g.key}>
                      <tr
                        className="bg-muted/30 hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => toggleGroup(g.key)}
                      >
                        <td className="px-4 py-2 font-semibold sticky left-0 bg-muted/30 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {g.label}
                            <span className="text-xs font-normal text-muted-foreground">({g.items.length})</span>
                          </span>
                        </td>
                        {g.monthTotals.map((h, i) => (
                          <td key={i} className="px-3 py-2 text-right font-semibold whitespace-nowrap">{h ? fmtHours(h) : '—'}</td>
                        ))}
                        <td className="px-4 py-2 text-right font-bold whitespace-nowrap">{fmtHours(g.total)}</td>
                      </tr>
                      {!collapsed && g.items.map((r) => (
                        <tr key={r.customerId} className="hover:bg-muted/20 transition-colors">
                          <td className="pl-8 pr-4 py-2.5 whitespace-nowrap sticky left-0 bg-background">{r.customerName || '—'}</td>
                          {r.months.map((h, i) => (
                            <td key={i} className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground">{h ? fmtHours(h) : '—'}</td>
                          ))}
                          <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">{fmtHours(r.total)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="px-4 py-2.5 whitespace-nowrap sticky left-0 bg-background">{t('consumption.total')}</td>
                  {grandTotals.totals.map((h, i) => (
                    <td key={i} className="px-3 py-2.5 text-right whitespace-nowrap">{fmtHours(h)}</td>
                  ))}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtHours(grandTotals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Página ────────────────────────────────────────────────────────────────────
const MyPoliciesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);
  const isAdmin = user?.role === 'admin';

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

      {isAdmin && <PolicyHoursByMonthPanel />}
    </div>
  );
};

export default MyPoliciesPage;
