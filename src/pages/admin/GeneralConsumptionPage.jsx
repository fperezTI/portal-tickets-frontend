import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useDateLocale } from '../../hooks/useDateLocale';
import { getGeneralConsumption, getGeneralConsumptionByCustomer } from '../../api/cases';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Gauge, Clock, DollarSign, ShieldCheck, RotateCcw, PlusCircle, CheckCircle2, TrendingUp, TrendingDown, Minus, ChevronRight, ChevronDown, Users } from 'lucide-react';
import { fmtHours as fmtHoursShared, cn } from '@/lib/utils';

// El backend devuelve `label` ya formateado en español (server-side, para el
// caso de que se consuma desde otro cliente) — para la UI se recalcula en el
// idioma activo a partir de la clave "YYYY-MM", igual que el resto de fechas.
const monthKeyToLabel = (monthKey, locale) => {
  const [y, m] = monthKey.split('-').map(Number);
  return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale });
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// Paleta de marca Grupo Staff (ver src/index.css): navy del logotipo, cyan y
// naranja del asterisco — usados aquí como acento de datos, no vía tokens
// genéricos de Tailwind, para que se lean como "de marca" en un reporte.
const BRAND_NAVY   = '#1B3860';
const BRAND_CYAN    = '#00B4CC';
const BRAND_ORANGE = '#F47920';

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

// ─── Fila del resumen ejecutivo de horas (valor + % + barra de proporción) ────
const HoursBreakdownRow = ({ icon: Icon, label, value, percent, colorClass, barClass }) => (
  <div>
    <div className="flex items-center justify-between text-sm mb-1.5 gap-3">
      <span className={cn('flex items-center gap-1.5 font-medium truncate', colorClass)}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
      <span className="tabular-nums whitespace-nowrap">
        <strong className={colorClass}>{fmtHoursShared(value)}h</strong>{' '}
        <span className="text-muted-foreground">({percent}%)</span>
      </span>
    </div>
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full', barClass)} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  </div>
);

// Consultores con un decimal (no redondeado hacia arriba) — dirección quiere
// ver la carga fraccional real (ej. "5.8"), no un entero inflado por el ceil.
const consultantsNeededFor = (hours, perConsultant) => (
  perConsultant > 0 ? (hours / perConsultant).toFixed(1) : '—'
);

// ─── Panel ejecutivo de dotación proyectada (consultores necesarios por mes,
// según horas/consultor configurables). Horas y consultores son ambos datos
// principales — mismo tamaño de fuente, horas arriba y consultores abajo. ───
const ConsultantForecastPanel = ({
  title, accentColor, forecast, dateLocale, metricKey,
  hoursPerConsultant, onHoursPerConsultantChange, inputId, insight,
}) => {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="text-xs font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1">
          <Label htmlFor={inputId} className="text-[10px] text-muted-foreground font-normal whitespace-nowrap">
            {t('generalConsumption.hoursPerConsultant')}
          </Label>
          <Input
            id={inputId}
            type="number"
            min="1"
            value={hoursPerConsultant}
            onChange={onHoursPerConsultantChange}
            className="h-6 w-14 text-xs px-1.5 bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {forecast.map((m) => (
          <div key={m.month} className="rounded-lg border px-2.5 py-2 bg-muted/20">
            <p className="text-[10px] font-bold text-foreground capitalize truncate">{monthKeyToLabel(m.month, dateLocale)}</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">
                {t('generalConsumption.estimated')}
              </span>
              <span className="text-lg font-bold tabular-nums" style={{ color: accentColor }}>
                {fmtHoursShared(m[metricKey])}h
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-0.5 pt-0.5 border-t">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">
                {t('generalConsumption.consultantsLabel')}
              </span>
              <span className="text-lg font-bold tabular-nums" style={{ color: accentColor }}>
                {consultantsNeededFor(m[metricKey], hoursPerConsultant)}
              </span>
            </div>
          </div>
        ))}
        <div className="rounded-lg px-2.5 py-2 border-2" style={{ borderColor: BRAND_ORANGE, backgroundColor: `${BRAND_ORANGE}0D` }}>
          <p className="text-[10px] font-bold text-foreground truncate">{t('generalConsumption.totalProjected')}</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">
              {t('generalConsumption.estimated')}
            </span>
            <span className="text-lg font-bold tabular-nums" style={{ color: BRAND_ORANGE }}>
              {insight ? fmtHoursShared(insight.total) : '—'}h
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5 pt-0.5 border-t" style={{ borderColor: `${BRAND_ORANGE}33` }}>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">
              {t('generalConsumption.consultantsLabelAvg')}
            </span>
            <span className="text-lg font-bold tabular-nums" style={{ color: BRAND_ORANGE }}>
              {insight && forecast.length ? consultantsNeededFor(insight.total / forecast.length, hoursPerConsultant) : '—'}
            </span>
          </div>
          {insight && (
            <p className={cn(
              'text-[10px] mt-1 font-medium text-right',
              insight.deltaPct > 3 ? 'text-amber-600' : insight.deltaPct < -3 ? 'text-green-600' : 'text-muted-foreground'
            )}>
              {insight.deltaPct > 0 ? '+' : ''}{insight.deltaPct}% {t('generalConsumption.vsTrendAverage')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tarjeta KPI (mismo estilo que Consumo) ────────────────────────────────────
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

const GeneralConsumptionPage = () => {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const year = parseInt(searchParams.get('year') || String(CURRENT_YEAR));
  const setYear = (y) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('year', String(y));
    return next;
  }, { replace: true });

  // Horas/mes que se espera que rinda un consultor — editable, para estimar
  // cuántos consultores hacen falta en cada mes del forecast. Separado por
  // métrica porque la capacidad facturable de un consultor suele ser menor
  // que sus horas trabajadas totales (tiempo no facturable incluido).
  const [hoursPerConsultantWorked, setHoursPerConsultantWorked] = useState(160);
  const [hoursPerConsultantBillable, setHoursPerConsultantBillable] = useState(120);

  const [months, setMonths] = useState([]);
  const [trend, setTrend] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [expandedMonth, setExpandedMonth] = useState(null);
  const [breakdownByMonth, setBreakdownByMonth] = useState({});
  const [breakdownLoading, setBreakdownLoading] = useState(null);
  const [breakdownError, setBreakdownError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getGeneralConsumption({ year });
      setMonths(result?.months || []);
      setTrend(result?.trend || []);
      setForecast(result?.forecast || []);
    } catch (err) {
      setError(err.response?.data?.error || t('generalConsumption.loadError'));
    } finally {
      setLoading(false);
    }
  }, [year, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Al cambiar de año se pierde el sentido de cualquier desglose ya abierto.
  useEffect(() => {
    setExpandedMonth(null);
    setBreakdownByMonth({});
    setBreakdownError('');
  }, [year]);

  const toggleMonth = (monthKey) => {
    if (expandedMonth === monthKey) {
      setExpandedMonth(null);
      return;
    }
    setExpandedMonth(monthKey);
    if (!breakdownByMonth[monthKey]) {
      setBreakdownLoading(monthKey);
      setBreakdownError('');
      getGeneralConsumptionByCustomer(monthKey)
        .then((res) => setBreakdownByMonth((prev) => ({ ...prev, [monthKey]: res?.rows || [] })))
        .catch((err) => setBreakdownError(err.response?.data?.error || t('generalConsumption.byCustomerError')))
        .finally(() => setBreakdownLoading(null));
    }
  };

  const totals = useMemo(() => {
    const sums = months.reduce((acc, m) => ({
      hoursWorked:    Math.round((acc.hoursWorked + m.hoursWorked) * 100) / 100,
      hoursBillable:  Math.round((acc.hoursBillable + (m.hoursBillable ?? 0)) * 100) / 100,
      hoursWarranty:  Math.round((acc.hoursWarranty + (m.hoursWarranty ?? 0)) * 100) / 100,
      ticketsCreated: acc.ticketsCreated + m.ticketsCreated,
      ticketsClosed:  acc.ticketsClosed + m.ticketsClosed,
    }), { hoursWorked: 0, hoursBillable: 0, hoursWarranty: 0, ticketsCreated: 0, ticketsClosed: 0 });
    // Retrabajos: horas trabajadas que no son ni facturables ni de garantía
    // (tiempo invertido que no se reflejó en ninguna de las dos categorías).
    const hoursRework = Math.max(0, Math.round((sums.hoursWorked - sums.hoursBillable - sums.hoursWarranty) * 100) / 100);
    return { ...sums, hoursRework };
  }, [months]);

  // Compara el promedio proyectado contra el promedio real de la tendencia
  // (últimos meses ya completos) para mostrar si la carga de trabajo va al
  // alza o a la baja — la referencia para decidir si hace falta más personal.
  const makeForecastInsight = (metric) => {
    if (!trend.length || !forecast.length) return null;
    const trendAvg = trend.reduce((s, m) => s + m[metric], 0) / trend.length;
    const forecastAvg = forecast.reduce((s, m) => s + m[metric], 0) / forecast.length;
    const total = Math.round(forecast.reduce((s, m) => s + m[metric], 0) * 100) / 100;
    const deltaPct = trendAvg > 0 ? Math.round(((forecastAvg - trendAvg) / trendAvg) * 1000) / 10 : 0;
    return { trendAvg, forecastAvg, total, deltaPct };
  };
  const forecastInsight = useMemo(() => makeForecastInsight('hoursWorked'), [trend, forecast]);
  const forecastBillableInsight = useMemo(() => makeForecastInsight('hoursBillable'), [trend, forecast]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" /> {t('nav.generalConsumption')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('generalConsumption.subtitle')}
          </p>
        </div>
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

      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2"><CardContent className="p-5"><Skeleton className="h-40 w-full" /></CardContent></Card>
          <div className="grid grid-cols-1 gap-4 content-start">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Resumen ejecutivo de horas: total trabajado como ancla, y el
              desglose de facturables / garantía / retrabajos con su % sobre
              ese total, en vez de tarjetas sueltas sin relación entre sí. */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {t('generalConsumption.hoursExecutiveTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary tabular-nums">{fmtHoursShared(totals.hoursWorked)}h</span>
                <span className="text-sm text-muted-foreground">{t('generalConsumption.hoursWorkedYear', { year })}</span>
              </div>
              <div className="space-y-3">
                <HoursBreakdownRow
                  icon={DollarSign}
                  label={t('generalConsumption.hoursBillableYear', { year })}
                  value={totals.hoursBillable}
                  percent={pct(totals.hoursBillable, totals.hoursWorked)}
                  colorClass="text-emerald-600"
                  barClass="bg-emerald-500"
                />
                <HoursBreakdownRow
                  icon={ShieldCheck}
                  label={t('generalConsumption.hoursWarrantyYear', { year })}
                  value={totals.hoursWarranty}
                  percent={pct(totals.hoursWarranty, totals.hoursWorked)}
                  colorClass="text-amber-600"
                  barClass="bg-amber-500"
                />
                <HoursBreakdownRow
                  icon={RotateCcw}
                  label={t('generalConsumption.hoursReworkYear', { year })}
                  value={totals.hoursRework}
                  percent={pct(totals.hoursRework, totals.hoursWorked)}
                  colorClass="text-rose-600"
                  barClass="bg-rose-500"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 content-start">
            <KpiCard
              icon={PlusCircle}
              value={totals.ticketsCreated}
              label={t('generalConsumption.ticketsCreatedYear', { year })}
              iconBg="bg-blue-50"
              iconColor="text-blue-900"
              valueColor="text-blue-900"
            />
            <KpiCard
              icon={CheckCircle2}
              value={totals.ticketsClosed}
              label={t('generalConsumption.ticketsClosedYear', { year })}
              iconBg="bg-green-50"
              iconColor="text-green-600"
              valueColor="text-green-600"
            />
          </div>
        </div>
      )}

      {/* Forecast a 3 meses — siempre relativo al mes en curso, sin importar
          qué año se esté viendo arriba, ya que planear personal solo tiene
          sentido hacia adelante desde hoy. Diseño ejecutivo: el número de
          consultores necesarios es el dato protagonista (para presentar a
          dirección), las horas quedan como detalle de soporte debajo. */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                {t('generalConsumption.forecastTitle')}
                {forecastInsight && forecastInsight.deltaPct > 3 && <TrendingUp className="h-5 w-5 text-amber-600" />}
                {forecastInsight && forecastInsight.deltaPct < -3 && <TrendingDown className="h-5 w-5 text-green-600" />}
                {forecastInsight && Math.abs(forecastInsight.deltaPct) <= 3 && <Minus className="h-5 w-5 text-muted-foreground" />}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('generalConsumption.forecastSubtitle', { count: trend.length || 6 })}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-primary/10 shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <>
              <ConsultantForecastPanel
                title={t('generalConsumption.hoursWorked')}
                accentColor={BRAND_NAVY}
                forecast={forecast}
                dateLocale={dateLocale}
                metricKey="hoursWorked"
                hoursPerConsultant={hoursPerConsultantWorked}
                onHoursPerConsultantChange={(e) => setHoursPerConsultantWorked(Math.max(1, parseInt(e.target.value) || 0))}
                inputId="hpc-worked"
                insight={forecastInsight}
              />
              <ConsultantForecastPanel
                title={t('generalConsumption.hoursBillable')}
                accentColor={BRAND_CYAN}
                forecast={forecast}
                dateLocale={dateLocale}
                metricKey="hoursBillable"
                hoursPerConsultant={hoursPerConsultantBillable}
                onHoursPerConsultantChange={(e) => setHoursPerConsultantBillable(Math.max(1, parseInt(e.target.value) || 0))}
                inputId="hpc-billable"
                insight={forecastBillableInsight}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {!loading && months.length === 0 && !error && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {t('generalConsumption.noData')}
            </div>
          )}

          {!loading && months.length > 0 && (
            <div className="overflow-x-auto">
              <p className="px-4 pt-3 text-xs text-muted-foreground">{t('generalConsumption.clickToExpand')}</p>
              <table className="w-full text-sm">
                <thead className="bg-muted/60 border-y">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap capitalize">{t('generalConsumption.month')}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('generalConsumption.hoursWorked')}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('generalConsumption.hoursBillable')}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('generalConsumption.ticketsCreated')}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('generalConsumption.ticketsClosed')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {months.map((m) => {
                    const isOpen = expandedMonth === m.month;
                    const rows = breakdownByMonth[m.month];
                    return (
                      <Fragment key={m.month}>
                        <tr
                          className="hover:bg-muted/20 transition-colors cursor-pointer select-none"
                          onClick={() => toggleMonth(m.month)}
                        >
                          <td className="px-4 py-2.5 font-medium capitalize whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              {monthKeyToLabel(m.month, dateLocale)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtHoursShared(m.hoursWorked)}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtHoursShared(m.hoursBillable ?? 0)}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">{m.ticketsCreated}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">{m.ticketsClosed}</td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={5} className="p-0 bg-muted/10 border-b">
                              <div className="px-4 py-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">{t('generalConsumption.byCustomerTitle')}</p>
                                {breakdownLoading === m.month && (
                                  <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                                  </div>
                                )}
                                {breakdownLoading !== m.month && breakdownError && (
                                  <Alert variant="destructive"><AlertDescription>{breakdownError}</AlertDescription></Alert>
                                )}
                                {breakdownLoading !== m.month && !breakdownError && rows && rows.length === 0 && (
                                  <p className="text-sm text-muted-foreground py-2">{t('generalConsumption.byCustomerEmpty')}</p>
                                )}
                                {breakdownLoading !== m.month && !breakdownError && rows && rows.length > 0 && (
                                  <div className="overflow-x-auto rounded-md border bg-background">
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted/40 border-b">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('generalConsumption.byCustomerClient')}</th>
                                          <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('generalConsumption.hoursWorked')}</th>
                                          <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('generalConsumption.hoursBillable')}</th>
                                          <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('generalConsumption.ticketsCreated')}</th>
                                          <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{t('generalConsumption.ticketsClosed')}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {rows.map((r) => (
                                          <tr key={r.customerId}>
                                            <td className="px-3 py-2 whitespace-nowrap">{r.customerName || '—'}</td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">{fmtHoursShared(r.hoursWorked)}</td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">{fmtHoursShared(r.hoursBillable)}</td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">{r.ticketsCreated}</td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">{r.ticketsClosed}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="px-4 py-2.5 whitespace-nowrap">{t('consumption.total')}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtHoursShared(totals.hoursWorked)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtHoursShared(totals.hoursBillable)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{totals.ticketsCreated}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{totals.ticketsClosed}</td>
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

export default GeneralConsumptionPage;
