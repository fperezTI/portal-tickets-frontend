import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getGeneralConsumption } from '../../api/cases';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Gauge, Clock, PlusCircle, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fmtHours as fmtHoursShared, cn } from '@/lib/utils';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const year = parseInt(searchParams.get('year') || String(CURRENT_YEAR));
  const setYear = (y) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('year', String(y));
    return next;
  }, { replace: true });

  const [months, setMonths] = useState([]);
  const [trend, setTrend] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getGeneralConsumption({ year });
      setMonths(result?.months || []);
      setTrend(result?.trend || []);
      setForecast(result?.forecast || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar el consumo general');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = useMemo(() => months.reduce((acc, m) => ({
    hoursWorked:    Math.round((acc.hoursWorked + m.hoursWorked) * 100) / 100,
    ticketsCreated: acc.ticketsCreated + m.ticketsCreated,
    ticketsClosed:  acc.ticketsClosed + m.ticketsClosed,
  }), { hoursWorked: 0, ticketsCreated: 0, ticketsClosed: 0 }), [months]);

  // Compara el promedio proyectado contra el promedio real de la tendencia
  // (últimos meses ya completos) para mostrar si la carga de trabajo va al
  // alza o a la baja — la referencia para decidir si hace falta más personal.
  const forecastInsight = useMemo(() => {
    if (!trend.length || !forecast.length) return null;
    const trendAvg = trend.reduce((s, m) => s + m.hoursWorked, 0) / trend.length;
    const forecastAvg = forecast.reduce((s, m) => s + m.hoursWorked, 0) / forecast.length;
    const total = Math.round(forecast.reduce((s, m) => s + m.hoursWorked, 0) * 100) / 100;
    const deltaPct = trendAvg > 0 ? Math.round(((forecastAvg - trendAvg) / trendAvg) * 1000) / 10 : 0;
    return { trendAvg, forecastAvg, total, deltaPct };
  }, [trend, forecast]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" /> Consumo General
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Horas trabajadas (Duration de tareas) y tickets creados/cerrados, por mes — todos los clientes
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            icon={Clock}
            value={fmtHoursShared(totals.hoursWorked)}
            label={`Horas trabajadas ${year}`}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            valueColor="text-primary"
          />
          <KpiCard
            icon={PlusCircle}
            value={totals.ticketsCreated}
            label={`Tickets creados ${year}`}
            iconBg="bg-blue-50"
            iconColor="text-blue-900"
            valueColor="text-blue-900"
          />
          <KpiCard
            icon={CheckCircle2}
            value={totals.ticketsClosed}
            label={`Tickets cerrados ${year}`}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            valueColor="text-green-600"
          />
        </div>
      )}

      {/* Forecast a 3 meses — siempre relativo al mes en curso, sin importar
          qué año se esté viendo arriba, ya que planear personal solo tiene
          sentido hacia adelante desde hoy. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {forecastInsight && forecastInsight.deltaPct > 3 && <TrendingUp className="h-4 w-4 text-amber-600" />}
            {forecastInsight && forecastInsight.deltaPct < -3 && <TrendingDown className="h-4 w-4 text-green-600" />}
            {forecastInsight && Math.abs(forecastInsight.deltaPct) <= 3 && <Minus className="h-4 w-4 text-muted-foreground" />}
            Proyección próximos 3 meses (forecast de personal)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Tendencia lineal sobre los últimos {trend.length || 6} meses ya cerrados — úsala como referencia de carga de trabajo esperada para dimensionar al equipo.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {forecast.map((m) => (
                <div key={m.month} className="rounded-lg border border-dashed p-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground capitalize truncate">{m.label}</p>
                  <p className="text-xl font-bold mt-1 text-primary">{fmtHoursShared(m.hoursWorked)}h</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Estimado</p>
                </div>
              ))}
              <div className="rounded-lg border p-3 bg-primary/5 border-primary/20">
                <p className="text-xs text-muted-foreground truncate">Total proyectado</p>
                <p className="text-xl font-bold mt-1">{forecastInsight ? fmtHoursShared(forecastInsight.total) : '—'}h</p>
                {forecastInsight && (
                  <p className={cn(
                    'text-[10px] mt-0.5 font-medium',
                    forecastInsight.deltaPct > 3 ? 'text-amber-600' : forecastInsight.deltaPct < -3 ? 'text-green-600' : 'text-muted-foreground'
                  )}>
                    {forecastInsight.deltaPct > 0 ? '+' : ''}{forecastInsight.deltaPct}% vs. promedio tendencia
                  </p>
                )}
              </div>
            </div>
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
              No hay datos de consumo para mostrar.
            </div>
          )}

          {!loading && months.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 border-y">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap capitalize">Mes</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Horas trabajadas</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Tickets creados</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Tickets cerrados</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {months.map((m) => (
                    <tr key={m.month} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium capitalize whitespace-nowrap">{m.label}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtHoursShared(m.hoursWorked)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">{m.ticketsCreated}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">{m.ticketsClosed}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="px-4 py-2.5 whitespace-nowrap">Total</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{fmtHoursShared(totals.hoursWorked)}</td>
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
