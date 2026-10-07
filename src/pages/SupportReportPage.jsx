import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getSupportReport, listSupportReportCustomers } from '../api/supportReport';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Printer, FileSpreadsheet, Clock, Ticket, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHEET_TEXT, STAGE_EN, MODULE_EN } from '@/lib/supportReportI18n';
import { LoadingCard } from '../components/LoadingMessages';
import { exportSupportTicketsExcel } from '@/lib/supportTicketsExcel';

// Reporte de soporte por cliente — port del Portal de auditoría (réplica del
// indicador "Soporte" de Power BI del usuario, para imprimirse a PDF). Reglas
// de negocio en getCustomerSupportReport (d365Service.js del backend).
// Diferencias con auditoría: lo ven los tres roles (un client solo ve su
// empresa, sin selector de cliente), sin logo de cliente, textos de la
// interfaz en el i18n del portal y "Idioma del reporte" arranca en el idioma
// del usuario. Los avisos internos (outOfPolicy, cierrePending) el backend ni
// siquiera los manda a un client.

const STAFF_ROLES = ['admin', 'support'];

// Clave interna del grupo sin customer user (la etiqueta visible sale de SHEET_TEXT).
const NO_CUSTOMER_USER = '__none__';

// Meses del periodo como claves "YYYY-MM" (el periodo puede cruzar de año, ver backend).
const monthLabel = (t, key, withYear) => `${t.months[Number(key.slice(5, 7)) - 1]}${withYear ? ` ${key.slice(2, 4)}` : ''}`;
const periodLabel = (t, p) => `${monthLabel(t, p.from, false)} ${p.from.slice(0, 4)} – ${monthLabel(t, p.to, false)} ${p.to.slice(0, 4)}`;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR + 1 - i);

const fmt2 = (n) => new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);
// Celdas vacías cuando no hubo horas — igual que el indicador original, para
// que la matriz se lea por dónde SÍ hubo actividad.
const cellVal = (n) => (n ? fmt2(n) : '');
// "YYYY-MM-DD" → "dd/mm/aaaa" por componentes, nunca new Date(iso) (corre el día por zona horaria).
// Inglés: "Feb 1, 2026" (sin la ambigüedad de mm/dd vs dd/mm).
const fmtDay = (lang, key) => {
  if (!key) return '—';
  const [y, m, d] = key.split('-');
  return lang === 'en' ? `${SHEET_TEXT.en.months[Number(m) - 1]} ${Number(d)}, ${y}` : `${d}/${m}/${y}`;
};

// Fondo de las celdas de un ticket con horas: verde (Trab.) / azul (Cons.); en
// tickets de GARANTÍA, naranja de advertencia en ambas columnas del mes con
// horas, para que se distinga que no se cobran.
const WARRANTY_BG = 'oklch(0.72 0.18 48 / 0.22)';
const cellBg = (tk, m, field) => {
  const b = tk.months[m];
  if (tk.isWarranty) return b.hours || b.billable ? { backgroundColor: WARRANTY_BG } : undefined;
  if (!b[field]) return undefined;
  return { backgroundColor: field === 'hours' ? 'oklch(0.56 0.14 155 / 0.16)' : 'oklch(0.68 0.11 208 / 0.18)' };
};

const SELECT_CLASS = 'h-9 rounded-md border bg-background px-3 text-sm';

// Tarjetas de resumen en pantalla (pedido del usuario, 2026-10-06): mismo
// estilo que las KpiCard de la antigua ConsumptionPage, un poco más compactas. No se imprimen.
const SummaryCard = ({ icon: Icon, value, label, iconBg, iconColor, valueColor }) => (
  // py-0 gap-0: el Card base trae py-6 (24 px) que se sumaba al relleno propio.
  <Card className="py-0 gap-0 hover:shadow-md transition-shadow">
    <CardContent className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate" title={label}>{label}</p>
          <p className={cn('text-2xl font-bold font-display mt-1 tabular-nums', valueColor)}>{value}</p>
        </div>
        <div className={cn('p-2 rounded-xl shrink-0', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const KpiTile = ({ label, value, tone }) => (
  <div className={cn('kpi-tile rounded-lg px-2 py-3 text-center border min-w-0', tone)}>
    <p className="kpi-label text-sm font-semibold leading-tight">{label}</p>
    <p className="kpi-value text-2xl 2xl:text-3xl font-bold font-display mt-1 tabular-nums">{fmt2(value)}</p>
  </div>
);

const ModuleChart = ({ data, t, lang }) => {
  // El backend manda "Sin módulo" y los nombres de Dynamics en español.
  const moduleLabel = (m) => (m === 'Sin módulo' ? t.noModule : lang === 'en' ? (MODULE_EN[m] ?? m) : m);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">{t.ticketsByModule}</p>
      {data.length === 0 && <p className="text-xs text-muted-foreground">{t.noTicketsInPeriod}</p>}
      {/* Lista compacta en 2 columnas, sin barras: con clientes de muchos
          módulos un gráfico de barras empujaba la tabla de tickets en el PDF. */}
      <div className="module-list columns-2 gap-4 text-[11px] leading-snug">
        {data.map((d) => (
          <div key={d.module} className="flex items-baseline justify-between gap-2 break-inside-avoid border-b border-border/60 py-0.5">
            <span className={cn('truncate', d.module === 'Sin módulo' && 'italic text-muted-foreground')} title={moduleLabel(d.module)}>{moduleLabel(d.module)}</span>
            <span className="tabular-nums font-semibold">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SupportReportPage = () => {
  const { t: tr, i18n } = useTranslation();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);
  // Textos de la hoja en el idioma de la INTERFAZ (para los botones de mes).
  const uiSheet = SHEET_TEXT[i18n.language === 'en' ? 'en' : 'es'];

  const [customers, setCustomers] = useState([]);
  // Cliente y año en la URL (convención del portal, ?client=&year=).
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('client') || '';
  const year = parseInt(searchParams.get('year') || String(CURRENT_YEAR), 10);
  const setCustomerId = (id) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (id) next.set('client', id); else next.delete('client');
    return next;
  }, { replace: true });
  const setYear = (y) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('year', String(y));
    return next;
  }, { replace: true });
  // Meses elegidos del periodo ("YYYY-MM"); null = todos. Acota TODA la hoja:
  // tablas, tarjetas, módulos y subtítulo.
  const [selectedMonths, setSelectedMonths] = useState(null);
  const [groupBy, setGroupBy] = useState('status'); // 'status' | 'customerUser'
  // Idioma SOLO de la hoja imprimible. Staff: arranca en su idioma y lo cambia
  // con "Idioma del reporte". Client: sin selector, siempre el idioma de su
  // usuario del portal (decisión del usuario, 2026-10-06).
  const userLang = user?.language === 'en' ? 'en' : 'es';
  const [staffLang, setLang] = useState(userLang);
  const lang = isStaff ? staffLang : userLang;
  const t = SHEET_TEXT[lang];
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  // Staff: solo clientes con actividad en tareas en el año elegido — se
  // recarga al cambiar de año; si el cliente elegido no tiene actividad en el
  // nuevo año, se limpia la selección. Un client no tiene selector.
  const [customersLoading, setCustomersLoading] = useState(isStaff);
  useEffect(() => {
    if (!isStaff) return undefined;
    let cancelled = false;
    setCustomersLoading(true);
    listSupportReportCustomers({ year })
      .then((r) => {
        if (cancelled) return;
        setCustomers(r.data);
        setSearchParams((prev) => {
          const id = prev.get('client');
          if (!id || r.data.some((c) => c.id === id)) return prev;
          const next = new URLSearchParams(prev);
          next.delete('client');
          return next;
        }, { replace: true });
      })
      .catch(() => { if (!cancelled) setError(i18n.t('supportReport.customersLoadError')); })
      .finally(() => { if (!cancelled) setCustomersLoading(false); });
    return () => { cancelled = true; };
  // setSearchParams fuera de las deps a propósito: cambia de identidad con cada
  // cambio de URL y recargaría la lista de clientes al elegir uno.
  }, [year, isStaff, i18n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isStaff && !customerId) { setReport(null); return; }
    // Guard de requestIdRef: si el usuario cambia de cliente/año rápido, una
    // respuesta vieja no debe pisar a la nueva.
    const reqId = ++requestIdRef.current;
    setReport(null);
    setError('');
    setLoading(true);
    getSupportReport(isStaff ? { customerId, year } : { year })
      .then((r) => { if (reqId === requestIdRef.current) { setReport(r); setSelectedMonths(null); } })
      .catch((e) => { if (reqId === requestIdRef.current) setError(e.response?.data?.error || i18n.t('supportReport.loadError')); })
      .finally(() => { if (reqId === requestIdRef.current) setLoading(false); });
  }, [customerId, year, isStaff, i18n]);

  // El nombre del PDF lo toma el navegador del <title> de la página.
  const onPrint = () => {
    const previous = document.title;
    document.title = `${t.pdfName} ${report.customer.name} ${report.year}`;
    window.print();
    document.title = previous;
  };

  const periodMonths = report?.period.months ?? [];
  // Con un periodo que cruza de año, cada mes lleva el año corto ("Ene 27").
  const crossesYear = periodMonths.length > 0 && periodMonths[0].slice(0, 4) !== periodMonths.at(-1).slice(0, 4);

  // ── Meses elegidos ───────────────────────────────────────────────────────
  // Todo se recalcula aquí sobre los meses elegidos, con los datos mes a mes que
  // ya trae el reporte (sin otra llamada al backend). Con todos los meses
  // elegidos, los números coinciden con los del backend.
  const selMonths = selectedMonths ? periodMonths.filter((m) => selectedMonths.includes(m)) : periodMonths;
  const isSubset = selMonths.length !== periodMonths.length;
  const r2 = (n) => Math.round(n * 100) / 100;
  const sumSel = (months, pick) => r2(selMonths.reduce((a, m) => a + pick(months[m]), 0));
  const bucketSel = (months) => ({ hours: sumSel(months, (b) => b.hours), billable: sumSel(months, (b) => b.billable) });
  const monthsWithActivity = report
    ? periodMonths.filter((m) => report.grandTotal.months[m].hours || report.grandTotal.months[m].billable)
    : [];

  const toggleMonth = (m) => setSelectedMonths((prev) => {
    const cur = prev ?? periodMonths;
    const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
    if (next.length === 0) return cur; // siempre al menos un mes
    return next.length === periodMonths.length ? null : next;
  });

  // Tickets con horas o consumo en algún mes elegido; su Total = solo esos meses.
  const ticketView = (tk) => ({ ...tk, total: bucketSel(tk.months) });
  const visibleTicket = (tk) => selMonths.some((m) => tk.months[m].hours || tk.months[m].billable);
  const allVisibleTickets = report
    ? report.statuses.flatMap((s) => s.tickets.filter(visibleTicket).map(ticketView))
    : [];

  // Agrupación de la matriz: por estatus (default, orden del backend) o por
  // "Customer user", armada aquí sumando los meses ya calculados de cada ticket.
  const groups = !report ? [] : groupBy === 'status'
    ? report.statuses
      .map((s) => ({
        key: s.status,
        label: lang === 'en' ? (STAGE_EN[s.stage] ?? s.stage) : s.status,
        months: s.months,
        total: bucketSel(s.months),
        tickets: s.tickets.filter(visibleTicket).map(ticketView),
      }))
      .filter((g) => g.tickets.length > 0)
    : (() => {
      const byUser = new Map();
      allVisibleTickets.forEach((tk) => {
        const key = tk.customerUser || NO_CUSTOMER_USER;
        if (!byUser.has(key)) byUser.set(key, []);
        byUser.get(key).push(tk);
      });
      const sumBucket = (tickets, pick) => ({
        hours: r2(tickets.reduce((a, tk) => a + pick(tk).hours, 0)),
        billable: r2(tickets.reduce((a, tk) => a + pick(tk).billable, 0)),
      });
      return [...byUser.entries()]
        .sort(([a], [b]) => (a === NO_CUSTOMER_USER) - (b === NO_CUSTOMER_USER) || a.localeCompare(b, 'es'))
        .map(([key, tickets]) => ({
          key,
          label: key === NO_CUSTOMER_USER ? t.noCustomerUser : key,
          months: Object.fromEntries(periodMonths.map((m) => [m, sumBucket(tickets, (tk) => tk.months[m])])),
          total: sumBucket(tickets, (tk) => tk.total),
          tickets: [...tickets].sort((a, b) => (a.ticketNumber || '').localeCompare(b.ticketNumber || '')),
        }));
    })();

  // Pólizas: al acotar meses se ocultan las que no tienen horas en ellos.
  const visiblePolicies = !report ? [] : report.policies
    .map((p) => ({ ...p, total: sumSel(p.months, (v) => v) }))
    .filter((p) => !isSubset || selMonths.some((m) => p.months[m]));
  const contractedSel = report ? sumSel(report.policyHours.months, (v) => v) : 0;
  const consumedSel = r2(allVisibleTickets.filter((tk) => !tk.isWarranty).reduce((a, tk) => a + tk.total.billable, 0));
  const warrantySel = r2(allVisibleTickets.filter((tk) => tk.isWarranty).reduce((a, tk) => a + tk.total.billable, 0));
  const summary = !report ? null : isSubset
    ? { policyHours: contractedSel, consumedHours: consumedSel, balance: r2(contractedSel - consumedSel), warrantyBillable: warrantySel }
    : report.summary;
  const grandTotal = report ? { months: report.grandTotal.months, total: bucketSel(report.grandTotal.months) } : null;
  const hasWarranty = allVisibleTickets.some((tk) => tk.isWarranty);
  // Promedio = horas consumidas / tickets sin garantía (mismo criterio que Consumo).
  const billableTicketCount = allVisibleTickets.filter((tk) => !tk.isWarranty).length;
  const avgPerTicket = summary && billableTicketCount ? r2(summary.consumedHours / billableTicketCount) : 0;
  const ticketsByModule = (() => {
    if (!report || !isSubset) return report?.ticketsByModule ?? [];
    const counts = new Map();
    allVisibleTickets.forEach((tk) => {
      const k = tk.module || 'Sin módulo';
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => (a.module === 'Sin módulo') - (b.module === 'Sin módulo') || b.count - a.count || a.module.localeCompare(b.module));
  })();

  // Subtítulo: periodo completo, rango consecutivo ("Jul 2026 – Sep 2026") o
  // lista de meses sueltos ("Jul, Sep 2026").
  const selectionLabel = (() => {
    if (!report) return '';
    if (!isSubset) return periodLabel(t, report.period);
    const idx = selMonths.map((m) => periodMonths.indexOf(m));
    const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
    const full = (m) => `${monthLabel(t, m, false)} ${m.slice(0, 4)}`;
    if (selMonths.length === 1) return full(selMonths[0]);
    if (consecutive) return `${full(selMonths[0])} – ${full(selMonths.at(-1))}`;
    const years = [...new Set(selMonths.map((m) => m.slice(0, 4)))];
    return years.length === 1
      ? `${selMonths.map((m) => monthLabel(t, m, false)).join(', ')} ${years[0]}`
      : selMonths.map((m) => full(m)).join(', ');
  })();

  // Excel "Support's Tickets": tickets de los meses elegidos, encabezados en el idioma del reporte.
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelError, setExcelError] = useState('');
  const onExportExcel = async () => {
    setExcelBusy(true);
    setExcelError('');
    try {
      await exportSupportTicketsExcel({ report, months: selMonths, monthsLabel: selectionLabel, lang });
    } catch {
      setExcelError(tr('supportReport.excelError'));
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 8mm; }
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .support-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; font-size: 9px; }
          .support-sheet table { font-size: 7px; }
          .support-sheet .matrix th, .support-sheet .matrix td { padding: 1px 2px !important; white-space: nowrap; font-size: 7px !important; }
          .support-sheet .matrix .ticket-cell { max-width: 2.3in; overflow: hidden; text-overflow: ellipsis; padding-left: 8px !important; }
          .support-sheet .kpi-value { font-size: 15px !important; }
          .support-sheet .kpi-tile { padding: 6px 4px !important; }
          .support-sheet .kpi-label { font-size: 8px !important; letter-spacing: -0.01em; }
          .support-sheet .module-list { font-size: 8px !important; }
          .support-sheet .matrix .ticket-cell span { font-size: 7px !important; }
          .support-sheet tr { break-inside: avoid; }
        }
      `}</style>

      <div className="print:hidden space-y-4">
        {/* Encabezado: título a la izquierda; filtros y botones a su nivel, a la derecha
            (pedido del usuario, 2026-10-06). En pantallas angostas los controles bajan de línea. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-xl">
            <h1 className="text-2xl font-bold tracking-tight">{tr('supportReport.title')}</h1>
          </div>

          <div className="flex flex-wrap items-end justify-end gap-2 ml-auto">
            {/* Controles sin etiqueta visible (pedido del usuario, 2026-10-06, para
                subir el encabezado); el nombre queda en aria-label y en el tooltip. */}
            {/* Sin campo "Buscar cliente" (pedido del usuario, 2026-10-06): la lista
                nativa ya permite saltar a un cliente tecleando su nombre. */}
            {isStaff && (
              <select id="sr-customer" className={cn(SELECT_CLASS, 'w-72')} value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                aria-label={tr('supportReport.customer')} title={tr('supportReport.customer')}>
                <option value="">{customersLoading ? tr('supportReport.loadingCustomers') : tr('supportReport.selectCustomerOption', { count: customers.length })}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <select id="sr-year" className={SELECT_CLASS} value={year} onChange={(e) => setYear(Number(e.target.value))}
              aria-label={tr('supportReport.year')} title={tr('supportReport.year')}>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select id="sr-group" className={SELECT_CLASS} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
              aria-label={tr('supportReport.groupBy')} title={tr('supportReport.groupBy')}>
              <option value="status">{tr('supportReport.groupStatus')}</option>
              <option value="customerUser">{tr('supportReport.groupCustomerUser')}</option>
            </select>
            {isStaff && (
              <select id="sr-lang" className={SELECT_CLASS} value={lang} onChange={(e) => setLang(e.target.value)}
                aria-label={tr('supportReport.reportLanguage')} title={tr('supportReport.reportLanguage')}>
                <option value="es">{tr('supportReport.spanish')}</option>
                <option value="en">{tr('supportReport.english')}</option>
              </select>
            )}

            {report && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" disabled={excelBusy || selMonths.length === 0} onClick={onExportExcel}>
                  <FileSpreadsheet className="h-4 w-4" /> {excelBusy ? tr('supportReport.generating') : tr('supportReport.exportExcel')}
                </Button>
                <Button size="sm" className="gap-2" onClick={onPrint}>
                  <Printer className="h-4 w-4" /> {tr('supportReport.print')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Meses del reporte: botones por mes del periodo + atajos. Acota toda la hoja, también el PDF.
            Solo admin (decisión del usuario, 2026-10-06): client y support siempre ven el periodo completo. */}
        {user?.role === 'admin' && report && periodMonths.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium mr-1">{tr('supportReport.reportMonths')}</span>
            {periodMonths.map((m) => {
              const on = selMonths.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMonth(m)}
                  className={cn(
                    'h-7 px-2 rounded text-xs font-medium border transition-colors',
                    on ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-input hover:text-foreground'
                  )}
                >
                  {monthLabel(uiSheet, m, crossesYear)}
                </button>
              );
            })}
            <button type="button" onClick={() => setSelectedMonths(null)} className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground underline">
              {tr('supportReport.allMonths')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonths(monthsWithActivity.length && monthsWithActivity.length !== periodMonths.length ? monthsWithActivity : null)}
              className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground underline"
            >
              {tr('supportReport.monthsWithActivity')}
            </button>
          </div>
        )}

        {excelError && <Alert variant="destructive"><AlertDescription>{excelError}</AlertDescription></Alert>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {isStaff && !customerId && !error && <p className="text-sm text-muted-foreground">{tr('supportReport.selectCustomerBody')}</p>}
        {loading && <LoadingCard set="supportReport" className="mx-auto my-6" />}
        {/* Avisos internos: solo staff (el backend no los manda a un client). */}
        {isStaff && report?.cierrePending?.taskCount > 0 && (
          <Alert>
            <AlertDescription>
              {tr('supportReport.cierrePending', {
                tickets: report.cierrePending.ticketCount, year: report.year,
                hours: fmt2(report.cierrePending.hours), billable: fmt2(report.cierrePending.billable),
              })}
            </AlertDescription>
          </Alert>
        )}
        {isStaff && report?.outOfPolicy?.taskCount > 0 && (
          <Alert>
            <AlertDescription>
              {tr('supportReport.outOfPolicy', {
                count: report.outOfPolicy.taskCount, year: report.year,
                hours: fmt2(report.outOfPolicy.hours), billable: fmt2(report.outOfPolicy.billable),
              })}
            </AlertDescription>
          </Alert>
        )}

        {/* Resumen en tarjetas (solo pantalla). Respetan los meses elegidos, igual que la hoja:
            Facturables = Consumidas; Tickets = los de la tabla (incluye garantía); Disponibles = Saldo. */}
        {report && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SummaryCard icon={Clock} value={fmt2(summary.consumedHours)}
              label={tr('consumption.billableHoursYear', { year: !isSubset && !crossesYear ? report.year : selectionLabel })}
              iconBg="bg-primary/10" iconColor="text-primary" valueColor="text-primary" />
            <SummaryCard icon={Ticket} value={allVisibleTickets.length}
              label={tr('consumption.ticketsWithConsumption')}
              iconBg="bg-blue-50" iconColor="text-blue-900" valueColor="text-blue-900" />
            <SummaryCard icon={ShieldCheck} value={fmt2(summary.warrantyBillable)}
              label={tr('consumption.warrantyHours')}
              iconBg="bg-amber-50" iconColor="text-amber-600" valueColor="text-amber-600" />
            <SummaryCard icon={TrendingUp} value={fmt2(avgPerTicket)}
              label={tr('consumption.avgHoursPerTicket')}
              iconBg="bg-green-50" iconColor="text-green-600" valueColor="text-green-600" />
            <SummaryCard icon={Wallet} value={fmt2(summary.balance)}
              label={tr('supportReport.availableHours')}
              iconBg={summary.balance < 0 ? 'bg-destructive/10' : 'bg-indigo-50'}
              iconColor={summary.balance < 0 ? 'text-destructive' : 'text-indigo-600'}
              valueColor={summary.balance < 0 ? 'text-destructive' : 'text-indigo-600'} />
          </div>
        )}
      </div>

      {report && (
        <div className="support-sheet bg-card border rounded-xl p-6 space-y-5">
          {/* Encabezado — sin logo del cliente (decisión del usuario): su nombre va a la derecha. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <img src="/LOGO%20GS%20Color_240x54.png" alt="Grupo Staff" className="h-14 object-contain justify-self-start" />
            <div className="text-center">
              <h2 className="text-2xl font-bold">{t.title}</h2>
              <p className="text-sm font-medium">{report.customer.name} · {selectionLabel}</p>
            </div>
            <span className="justify-self-end text-lg font-bold text-right">{report.customer.name}</span>
          </div>

          {/* Póliza por mes + KPIs + módulos */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)] print:grid-cols-[1.4fr_1.05fr_0.95fr] gap-5 items-start">
            {/* Subido la altura de su título: así la tabla queda al mismo nivel que las tarjetas. */}
            <div className="space-y-1 lg:-mt-6 print:-mt-6">
              <p className="text-sm font-semibold">{t.policyHoursByMonth}</p>
              <div className="overflow-x-auto print:overflow-visible"><table className="w-full text-xs border-collapse tabular-nums">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-1 py-1 font-semibold text-left">{t.policy}</th>
                    {selMonths.map((m) => <th key={m} className="px-1 py-1 font-semibold text-right whitespace-nowrap">{monthLabel(t, m, crossesYear)}</th>)}
                    <th className="px-1 py-1 font-semibold text-right">{t.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Una fila por póliza; con varias, una fila Total al final. El
                      resaltado de "mes sin horas" va solo en la fila que representa
                      el total (con varias pólizas, el 0 de una puede estar cubierto por otra). */}
                  {visiblePolicies.map((p) => {
                    const isTotalRow = visiblePolicies.length === 1;
                    return (
                      <tr key={p.id}>
                        <td className="px-1 py-1 border-b font-mono whitespace-nowrap">{p.name}</td>
                        {selMonths.map((m) => (
                          <td key={m} className="px-1 py-1 text-right border-b"
                            style={isTotalRow && !p.months[m] ? { backgroundColor: 'oklch(0.72 0.18 48 / 0.16)' } : undefined}>
                            {isTotalRow ? fmt2(p.months[m]) : cellVal(p.months[m])}
                          </td>
                        ))}
                        <td className="px-1 py-1 text-right border-b font-bold">{fmt2(p.total)}</td>
                      </tr>
                    );
                  })}
                  {visiblePolicies.length !== 1 && (
                    <tr className="font-bold bg-muted/50">
                      <td className="px-1 py-1 border-b">{report.policies.length === 0 ? t.noPolicy : t.total}</td>
                      {selMonths.map((m) => {
                        const v = report.policyHours.months[m];
                        return (
                          <td key={m} className="px-1 py-1 text-right border-b"
                            style={!v ? { backgroundColor: 'oklch(0.72 0.18 48 / 0.16)' } : undefined}>
                            {fmt2(v)}
                          </td>
                        );
                      })}
                      <td className="px-1 py-1 text-right border-b">{fmt2(contractedSel)}</td>
                    </tr>
                  )}
                </tbody>
              </table></div>
              {report.policies.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {t.policies}: {report.policies.map((p) => `${p.name} (${fmtDay(lang, p.startDate)} – ${fmtDay(lang, p.dueDate)})`).join(', ')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <KpiTile label={t.kpiPolicy} value={summary.policyHours} tone="bg-secondary" />
              <KpiTile label={t.kpiSupport} value={summary.consumedHours} tone="bg-accent" />
              <KpiTile label={t.kpiBalance} value={summary.balance}
                tone={summary.balance < 0 ? 'bg-destructive/10 text-destructive border-destructive/40' : 'bg-[var(--good-bg)]'} />
            </div>

            <ModuleChart data={ticketsByModule} t={t} lang={lang} />
          </div>

          {/* Matriz Estatus > Ticket × Mes */}
          <div className="overflow-x-auto print:overflow-visible">
            <table className="matrix w-full text-xs border-collapse tabular-nums">
              <thead>
                <tr className="bg-muted">
                  <th rowSpan={2} className="px-2 py-1 text-left font-semibold align-bottom min-w-64 print:min-w-0">{groupBy === 'status' ? t.statusTicket : t.customerUserTicket}</th>
                  {selMonths.map((m) => <th key={m} colSpan={2} className="px-1 py-1 font-semibold text-center border-l whitespace-nowrap">{monthLabel(t, m, crossesYear)}</th>)}
                  <th colSpan={2} className="px-1 py-1 font-semibold text-center border-l">{t.total}</th>
                </tr>
                <tr className="bg-muted text-[10px] text-muted-foreground">
                  {[...selMonths, 'T'].map((m) => (
                    <Fragment key={m}>
                      <th className="px-1 py-0.5 font-medium text-right border-l">{t.hours}</th>
                      <th className="px-1 py-0.5 font-medium text-right">{t.billable}</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((s) => (
                  <Fragment key={s.key}>
                    <tr className="font-bold bg-muted/50">
                      <td className="px-2 py-1">{s.label} <span className="font-normal text-muted-foreground">({t.ticketCount(s.tickets.length)})</span></td>
                      {selMonths.map((m) => (
                        <Fragment key={m}>
                          <td className="px-1 py-1 text-right border-l">{cellVal(s.months[m].hours)}</td>
                          <td className="px-1 py-1 text-right">{cellVal(s.months[m].billable)}</td>
                        </Fragment>
                      ))}
                      <td className="px-1 py-1 text-right border-l">{fmt2(s.total.hours)}</td>
                      <td className="px-1 py-1 text-right">{fmt2(s.total.billable)}</td>
                    </tr>
                    {s.tickets.map((tk) => (
                      <tr key={tk.ticketId} className="border-b border-border/60">
                        <td className="ticket-cell px-2 py-0.5 pl-5 max-w-96" title={tk.title}>
                          <span className="font-mono">{tk.ticketNumber}</span>
                          {/* Antes del título: en el PDF el título se corta con "…" y la marca no debe perderse. */}
                          {tk.isWarranty && (
                            <span className="ml-1.5 inline-block rounded px-1 text-[10px] font-semibold border"
                              style={{ color: 'var(--gs-orange)', borderColor: 'var(--gs-orange)' }}>
                              {t.warranty}
                            </span>
                          )}
                          {' '}{tk.title}
                        </td>
                        {selMonths.map((m) => (
                          <Fragment key={m}>
                            <td className="px-1 py-0.5 text-right border-l" style={cellBg(tk, m, 'hours')}>
                              {cellVal(tk.months[m].hours)}
                            </td>
                            <td className="px-1 py-0.5 text-right" style={cellBg(tk, m, 'billable')}>
                              {cellVal(tk.months[m].billable)}
                            </td>
                          </Fragment>
                        ))}
                        <td className="px-1 py-0.5 text-right border-l font-semibold">{fmt2(tk.total.hours)}</td>
                        <td className="px-1 py-0.5 text-right font-semibold">{fmt2(tk.total.billable)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {groups.length === 0 && (
                  <tr><td colSpan={selMonths.length * 2 + 3} className="px-2 py-4 text-center text-muted-foreground">{t.noHoursInPeriod}</td></tr>
                )}
                {/* Total como fila del tbody, no <tfoot>: el navegador repite el tfoot en cada página impresa. */}
                <tr className="font-bold bg-muted border-t-2">
                  <td className="px-2 py-1">{t.total} <span className="font-normal text-muted-foreground">({t.ticketCount(groups.reduce((a, g) => a + g.tickets.length, 0))})</span></td>
                  {selMonths.map((m) => (
                    <Fragment key={m}>
                      <td className="px-1 py-1 text-right border-l">{cellVal(grandTotal.months[m].hours)}</td>
                      <td className="px-1 py-1 text-right">{cellVal(grandTotal.months[m].billable)}</td>
                    </Fragment>
                  ))}
                  <td className="px-1 py-1 text-right border-l">{fmt2(grandTotal.total.hours)}</td>
                  <td className="px-1 py-1 text-right">{fmt2(grandTotal.total.billable)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {hasWarranty && (
            <p className="text-[11px] text-muted-foreground">
              {t.warrantyNote(fmt2(summary.warrantyBillable))}
            </p>
          )}
          {/* Leyenda de los encabezados cortos de la matriz (siempre, también en el PDF). */}
          <p className="text-[11px] text-muted-foreground">{t.columnsLegend}</p>
          {/* Cliente "Cierre": horas por mes de cierre del ticket (también en el PDF). */}
          {report.isCierre && <p className="text-[11px] text-muted-foreground">{t.cierreNote}</p>}
        </div>
      )}
    </div>
  );
};

export default SupportReportPage;
