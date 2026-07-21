import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDashboard } from '../api/cases';
import { resolveAccount, resolveContact } from '../api/d365';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Ticket, AlertTriangle, Clock, CheckCircle2, Inbox, BarChart2, TrendingUp, Flame, Layers, ShieldCheck,
} from 'lucide-react';
import { fmtHours } from '@/lib/utils';

// ─── Colores de etapa (por prefijo numérico en el nombre) ─────────────────────
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
  const lower = name?.toLowerCase() ?? '';
  const idx = STAGE_ORDER.findIndex((kw) => lower.includes(kw));
  return idx === -1 ? 99 : idx;
};

const STAFF_ROLES = ['admin', 'support'];

// ─── Tarjeta KPI ─────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, value, label, iconBg = 'bg-muted', iconColor = 'text-muted-foreground', valueColor = 'text-foreground' }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
          <p className={`text-4xl font-bold mt-1.5 tabular-nums ${valueColor}`}>
            {value ?? <span className="text-2xl text-muted-foreground">—</span>}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl shrink-0 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─── Gráfica de líneas mensual (genérica, 1+ series) ──────────────────────────
const CYAN   = '#00B4CC';
const GREEN  = '#16A34A';
const INDIGO = '#6366F1';

// `series`: [{ key, color, label, formatValue? }] — una línea por serie,
// todas comparten la misma escala (útil para created/closed; para una sola
// serie como horas simplemente se pasa un arreglo de un elemento).
const LineChart = ({ data, series }) => {
  const SVG_W = 580, SVG_H = 170;
  const PAD = { top: 22, right: 14, bottom: 28, left: 32 };
  const W = SVG_W - PAD.left - PAD.right;
  const H = SVG_H - PAD.top - PAD.bottom;

  const max = Math.max(...data.flatMap((d) => series.map((s) => d[s.key] ?? 0)), 1);
  const n   = data.length;

  const xPos = (i) => PAD.left + (n < 2 ? W / 2 : (i / (n - 1)) * W);
  const yPos = (v) => PAD.top + H - (v / max) * H;

  const smoothPath = (key) => {
    const pts = data.map((d, i) => ({ x: xPos(i), y: yPos(d[key] ?? 0) }));
    if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`;
    const tension = 0.35;
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0   = pts[i - 1];
      const p1   = pts[i];
      const prev = pts[i - 2] ?? p0;
      const next = pts[i + 1] ?? p1;
      const cp1x = (p0.x + (p1.x - prev.x) * tension).toFixed(1);
      const cp1y = (p0.y + (p1.y - prev.y) * tension).toFixed(1);
      const cp2x = (p1.x - (next.x - p0.x) * tension).toFixed(1);
      const cp2y = (p1.y - (next.y - p0.y) * tension).toFixed(1);
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const areaPath = (key) => {
    const base = yPos(0);
    return `${smoothPath(key)} L ${xPos(n - 1).toFixed(1)},${base.toFixed(1)} L ${xPos(0).toFixed(1)},${base.toFixed(1)} Z`;
  };

  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(max * r));

  return (
    <div className="space-y-3">
      {series.length > 1 && (
        <div className="flex gap-6 justify-end">
          {series.map(({ key, color, label }) => (
            <div key={key} className="flex items-center gap-2">
              <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke={color} strokeWidth="2.5" strokeLinecap="round" /><circle cx="12" cy="5" r="3" fill="white" stroke={color} strokeWidth="2" /></svg>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full overflow-visible" style={{ height: SVG_H }}>
        <defs>
          {series.map(({ key, color }) => (
            <linearGradient key={key} id={`lg-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid */}
        {gridTicks.map((v) => {
          const y = yPos(v);
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={SVG_W - PAD.right} y2={y}
                stroke="#e5e7eb" strokeWidth="1" strokeDasharray={v === 0 ? undefined : '3,3'} />
              <text x={PAD.left - 5} y={y} textAnchor="end" fontSize="9"
                fill="#9ca3af" dominantBaseline="middle">{v}</text>
            </g>
          );
        })}

        {/* Area fills */}
        {series.map(({ key }) => <path key={key} d={areaPath(key)} fill={`url(#lg-${key})`} />)}

        {/* Lines */}
        {series.map(({ key, color }) => (
          <path key={key} d={smoothPath(key)} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        ))}

        {/* Dots + value labels + month labels */}
        {data.map((d, i) => {
          const cx = xPos(i);
          return (
            <g key={d.label}>
              {series.map(({ key, color, formatValue }) => {
                const val = d[key] ?? 0;
                const cy = yPos(val);
                return (
                  <g key={key}>
                    <circle cx={cx} cy={cy} r="4" fill="white" stroke={color} strokeWidth="2.5" />
                    {val > 0 && (
                      <text x={cx} y={cy - 9} textAnchor="middle" fontSize="9" fill="#6b7280">
                        {formatValue ? formatValue(val) : val}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={cx} y={SVG_H - 4} textAnchor="middle" fontSize="10" fontWeight="500" fill="#9ca3af">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─── Skeletons de carga ───────────────────────────────────────────────────────
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
      ))}
    </div>
    <Card><CardContent className="p-6"><Skeleton className="h-52 w-full" /></CardContent></Card>
  </div>
);

// ─── Página ───────────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerLabel, setCustomerLabel] = useState(user?.fullName || user?.email || '');

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setError(t('dashboard.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (isStaff) return;
    if (user?.d365AccountId) {
      resolveAccount(user.d365AccountId)
        .then((a) => setCustomerLabel(a.name))
        .catch(() => {});
    } else if (user?.d365ContactId) {
      resolveContact(user.d365ContactId)
        .then((c) => setCustomerLabel(c.name))
        .catch(() => {});
    }
  }, [isStaff, user?.d365AccountId, user?.d365ContactId]);

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
      <DashboardSkeleton />
    </div>
  );

  if (error) return (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  const { activeTotal, byPriority, unassigned, warranty, byStage = [], monthly } = data;
  const { critica = 0, alta = 0, normal = 0, baja = 0 } = byPriority;
  const totalMonthCreated = monthly.reduce((s, m) => s + m.created, 0);
  const totalMonthClosed  = monthly.reduce((s, m) => s + m.closed, 0);

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isStaff ? t('dashboard.globalView') : t('dashboard.customerSummary', { customer: customerLabel })}
        </p>
      </div>

      {/* KPIs principales — por prioridad */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Flame}
          value={critica}
          label={t('priority.critical')}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          valueColor="text-red-600"
        />
        <KpiCard
          icon={AlertTriangle}
          value={alta}
          label={t('dashboard.highPriority')}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          valueColor={alta > 0 ? 'text-orange-500' : 'text-foreground'}
        />
        <KpiCard
          icon={Clock}
          value={normal}
          label={t('dashboard.normalPriority')}
          iconBg="bg-blue-50"
          iconColor="text-blue-900"
          valueColor="text-blue-900"
        />
        <KpiCard
          icon={CheckCircle2}
          value={baja}
          label={t('dashboard.lowPriority')}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          valueColor="text-green-600"
        />
      </div>

      {/* Fila de gráficas — tickets y horas por mes, una junto a la otra */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              {t('dashboard.monthlyChartTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {monthly.every((m) => m.created === 0 && m.closed === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common.noDataToShow')}</p>
            ) : (
              <LineChart
                data={monthly}
                series={[
                  { key: 'created', color: CYAN,  label: t('dashboard.created') },
                  { key: 'closed',  color: GREEN, label: t('dashboard.closed') },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t('dashboard.hoursChartTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {monthly.every((m) => !m.hoursBillable) ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common.noDataToShow')}</p>
            ) : (
              <LineChart
                data={monthly}
                series={[
                  { key: 'hoursBillable', color: INDIGO, label: t('dashboard.hoursBillable'), formatValue: (v) => fmtHours(v) },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPIs principales — totales operativos */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={Ticket}
          value={activeTotal}
          label={t('dashboard.activeTickets')}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          valueColor="text-primary"
        />
        <KpiCard
          icon={Inbox}
          value={unassigned}
          label={t('dashboard.unassigned')}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-600"
          valueColor={unassigned > 0 ? 'text-orange-600' : 'text-foreground'}
        />
        <KpiCard
          icon={ShieldCheck}
          value={warranty}
          label={t('dashboard.warranty')}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          valueColor="text-amber-600"
        />
      </div>

      {/* Por etapa + Resumen (misma altura por estar en el mismo grid row) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Tickets activos por etapa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              {t('dashboard.activeByStage')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {byStage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t('dashboard.noStageData')}</p>
            ) : (
              <div className="space-y-2.5">
                {[...byStage].sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage)).map(({ stage, count }) => {
                  const color = stageColor(stage);
                  const pct   = activeTotal > 0 ? Math.round((count / activeTotal) * 100) : 0;
                  return (
                    <div key={stage} className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold w-28 shrink-0 truncate" style={{ color }} title={stage}>
                        {stage}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-14 text-right shrink-0">
                        {count} <span className="text-[10px]">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen del período */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              {t('dashboard.periodSummary')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-5">

            {/* Tres métricas clave */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl py-3 px-2" style={{ background: '#EFF9FB' }}>
                <p className="text-2xl font-bold tabular-nums" style={{ color: CYAN }}>{totalMonthCreated}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t('dashboard.created')}</p>
              </div>
              <div className="rounded-xl py-3 px-2 bg-green-50">
                <p className="text-2xl font-bold tabular-nums text-green-600">{totalMonthClosed}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t('dashboard.closed')}</p>
              </div>
              <div className="rounded-xl py-3 px-2 bg-primary/5">
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {totalMonthCreated > 0 ? Math.round((totalMonthClosed / totalMonthCreated) * 100) : 0}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t('dashboard.closeRate')}</p>
              </div>
            </div>

            <div className="border-t" />

            {/* Distribución por prioridad */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t('dashboard.priorityDistribution')}
              </p>
              <div className="space-y-2.5">
                {[
                  { label: t('priority.critical'), value: critica, color: '#DC2626' },
                  { label: t('priority.high'),      value: alta,    color: '#EA580C' },
                  { label: t('priority.normal'),    value: normal,  color: '#1B3860' },
                  { label: t('priority.low'),       value: baja,    color: '#16A34A' },
                ].map(({ label, value, color }) => {
                  const pct = activeTotal > 0 ? Math.round((value / activeTotal) * 100) : 0;
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold w-12 shrink-0" style={{ color }}>{label}</span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-14 text-right shrink-0">
                        {value} <span className="text-[10px]">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default DashboardPage;
