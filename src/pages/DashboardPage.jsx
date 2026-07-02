import { useEffect, useState } from 'react';
import { getDashboard } from '../api/cases';
import { resolveAccount, resolveContact } from '../api/d365';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Ticket, AlertTriangle, Clock, CheckCircle2, Inbox, BarChart2, TrendingUp, Flame, Layers, ShieldCheck,
} from 'lucide-react';

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

// ─── Gráfica de líneas mensual ────────────────────────────────────────────────
const CYAN  = '#00B4CC';
const GREEN = '#16A34A';

const LineChart = ({ data }) => {
  const SVG_W = 580, SVG_H = 170;
  const PAD = { top: 22, right: 14, bottom: 28, left: 32 };
  const W = SVG_W - PAD.left - PAD.right;
  const H = SVG_H - PAD.top - PAD.bottom;

  const max = Math.max(...data.flatMap((d) => [d.created, d.closed]), 1);
  const n   = data.length;

  const xPos = (i) => PAD.left + (n < 2 ? W / 2 : (i / (n - 1)) * W);
  const yPos = (v) => PAD.top + H - (v / max) * H;

  const smoothPath = (key) => {
    const pts = data.map((d, i) => ({ x: xPos(i), y: yPos(d[key]) }));
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

  const areaPath = (key, color) => {
    const base = yPos(0);
    return `${smoothPath(key)} L ${xPos(n - 1).toFixed(1)},${base.toFixed(1)} L ${xPos(0).toFixed(1)},${base.toFixed(1)} Z`;
  };

  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(max * r));

  return (
    <div className="space-y-3">
      <div className="flex gap-6 justify-end">
        {[{ color: CYAN, label: 'Generados' }, { color: GREEN, label: 'Cerrados' }].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke={color} strokeWidth="2.5" strokeLinecap="round" /><circle cx="12" cy="5" r="3" fill="white" stroke={color} strokeWidth="2" /></svg>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full overflow-visible" style={{ height: SVG_H }}>
        <defs>
          <linearGradient id="lg-cyan"  x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={CYAN}  stopOpacity="0.18" />
            <stop offset="100%" stopColor={CYAN}  stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lg-green" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={GREEN} stopOpacity="0.14" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
          </linearGradient>
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
        <path d={areaPath('created')} fill="url(#lg-cyan)" />
        <path d={areaPath('closed')}  fill="url(#lg-green)" />

        {/* Lines */}
        <path d={smoothPath('created')} fill="none" stroke={CYAN}  strokeWidth="2.5" strokeLinecap="round" />
        <path d={smoothPath('closed')}  fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" />

        {/* Dots + value labels + month labels */}
        {data.map((d, i) => {
          const cx = xPos(i);
          const cy1 = yPos(d.created);
          const cy2 = yPos(d.closed);
          return (
            <g key={d.label}>
              <circle cx={cx} cy={cy1} r="4" fill="white" stroke={CYAN}  strokeWidth="2.5" />
              <circle cx={cx} cy={cy2} r="4" fill="white" stroke={GREEN} strokeWidth="2.5" />
              {d.created > 0 && <text x={cx} y={cy1 - 9} textAnchor="middle" fontSize="9" fill="#6b7280">{d.created}</text>}
              {d.closed  > 0 && <text x={cx} y={cy2 - 9} textAnchor="middle" fontSize="9" fill="#6b7280">{d.closed}</text>}
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
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerLabel, setCustomerLabel] = useState(user?.fullName || user?.email || '');

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setError('No se pudieron cargar los indicadores'))
      .finally(() => setLoading(false));
  }, []);

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
      <h1 className="text-xl font-semibold tracking-tight">Panel de indicadores</h1>
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
        <h1 className="text-xl font-semibold tracking-tight">Panel de indicadores</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isStaff ? 'Vista global del sistema' : `Resumen de tickets — ${customerLabel}`}
        </p>
      </div>

      {/* KPIs principales — fila 1: totales operativos */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={Ticket}
          value={activeTotal}
          label="Tickets activos"
          iconBg="bg-primary/10"
          iconColor="text-primary"
          valueColor="text-primary"
        />
        <KpiCard
          icon={Inbox}
          value={unassigned}
          label="Por asignar"
          iconBg="bg-orange-500/10"
          iconColor="text-orange-600"
          valueColor={unassigned > 0 ? 'text-orange-600' : 'text-foreground'}
        />
        <KpiCard
          icon={ShieldCheck}
          value={warranty}
          label="Garantía"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          valueColor="text-amber-600"
        />
      </div>

      {/* KPIs principales — fila 2: por prioridad */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Flame}
          value={critica}
          label="Crítica"
          iconBg="bg-red-50"
          iconColor="text-red-600"
          valueColor="text-red-600"
        />
        <KpiCard
          icon={AlertTriangle}
          value={alta}
          label="Alta prioridad"
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          valueColor={alta > 0 ? 'text-orange-500' : 'text-foreground'}
        />
        <KpiCard
          icon={Clock}
          value={normal}
          label="Prioridad normal"
          iconBg="bg-blue-50"
          iconColor="text-blue-900"
          valueColor="text-blue-900"
        />
        <KpiCard
          icon={CheckCircle2}
          value={baja}
          label="Baja prioridad"
          iconBg="bg-green-50"
          iconColor="text-green-600"
          valueColor="text-green-600"
        />
      </div>

      {/* Fila 1: Por etapa + Resumen (misma altura por estar en el mismo grid row) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Tickets activos por etapa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Tickets activos por etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {byStage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin datos de etapa</p>
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
              Resumen del período
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-5">

            {/* Tres métricas clave */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl py-3 px-2" style={{ background: '#EFF9FB' }}>
                <p className="text-2xl font-bold tabular-nums" style={{ color: CYAN }}>{totalMonthCreated}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Generados</p>
              </div>
              <div className="rounded-xl py-3 px-2 bg-green-50">
                <p className="text-2xl font-bold tabular-nums text-green-600">{totalMonthClosed}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Cerrados</p>
              </div>
              <div className="rounded-xl py-3 px-2 bg-primary/5">
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {totalMonthCreated > 0 ? Math.round((totalMonthClosed / totalMonthCreated) * 100) : 0}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Tasa cierre</p>
              </div>
            </div>

            <div className="border-t" />

            {/* Distribución por prioridad */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Distribución por prioridad — activos
              </p>
              <div className="space-y-2.5">
                {[
                  { label: 'Crítica', value: critica, color: '#DC2626' },
                  { label: 'Alta',    value: alta,    color: '#EA580C' },
                  { label: 'Normal',  value: normal,  color: '#1B3860' },
                  { label: 'Baja',    value: baja,    color: '#16A34A' },
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

      {/* Fila 2: Gráfica de líneas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            Tickets por mes (últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {monthly.every((m) => m.created === 0 && m.closed === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos para mostrar</p>
          ) : (
            <LineChart data={monthly} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
