import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCaseDetail } from '../api/cases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import CaseStatusBadge from '../components/CaseStatusBadge';
import {
  ArrowLeft, Mail, Phone, CheckSquare, StickyNote,
  Calendar, FileText, Search, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Priority badge ────────────────────────────────────────────────────────────
const PRIORITY_COLOR = {
  0: { label: 'Crítica', color: '#DC2626', bg: '#FEF2F2' },
  1: { label: 'Alta',    color: '#EA580C', bg: '#FFF7ED' },
  2: { label: 'Normal',  color: '#1B3860', bg: '#EFF6FF' },
  3: { label: 'Baja',    color: '#16A34A', bg: '#F0FDF4' },
};
const PriorityBadge = ({ code }) => {
  const p = PRIORITY_COLOR[code];
  if (!p) return <span className="font-medium text-sm">Normal</span>;
  return (
    <span style={{ color: p.color, background: p.bg, borderRadius: 9999, padding: '5px 16px', fontSize: 14, fontWeight: 700 }}>
      {p.label}
    </span>
  );
};

// ─── Stage badge ───────────────────────────────────────────────────────────────
const STAGE_KEYWORD_COLOR = [
  { kw: 'approval',    color: '#94A3B8' },
  { kw: 'in progress', color: '#0EA5E9' },
  { kw: 'progress',    color: '#0EA5E9' },
  { kw: 'wait',        color: '#EAB308' },
  { kw: 'test',        color: '#F97316' },
  { kw: 'resolv',      color: '#22C55E' },
  { kw: 'clos',        color: '#1E3A8A' },
];
const STAGE_PALETTE = ['#94A3B8', '#0EA5E9', '#EAB308', '#F97316', '#22C55E', '#1E3A8A'];
const stageColor = (name) => {
  if (!name) return '#94A3B8';
  const m = name.match(/^(\d+)/);
  if (m) return STAGE_PALETTE[parseInt(m[1]) - 1] ?? '#94A3B8';
  const lower = name.toLowerCase();
  return STAGE_KEYWORD_COLOR.find(({ kw }) => lower.includes(kw))?.color ?? '#94A3B8';
};
const StageBadge = ({ name }) => {
  if (!name) return null;
  const c = stageColor(name);
  return (
    <span style={{ color: c, border: `1px solid ${c}40`, background: `${c}18`, borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
      {name}
    </span>
  );
};

// ─── Generic detail field ──────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div>
    <p className="text-muted-foreground text-xs mb-1">{label}</p>
    <div className="text-sm font-medium">{children || <span className="text-muted-foreground font-normal">—</span>}</div>
  </div>
);

// ─── Avatar initials ───────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#7C3AED', '#0EA5E9', '#16A34A', '#EA580C',
  '#DB2777', '#0891B2', '#65A30D', '#9333EA',
];
const avatarColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const initials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};
const Avatar = ({ name }) => (
  <div
    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
    style={{ background: avatarColor(name || '') }}
  >
    {initials(name || '?')}
  </div>
);

// ─── Activity type icon ────────────────────────────────────────────────────────
const ActivityIcon = ({ type }) => {
  const cls = 'h-3.5 w-3.5';
  if (type === 'email')       return <Mail className={cls} />;
  if (type === 'phonecall')   return <Phone className={cls} />;
  if (type === 'task')        return <CheckSquare className={cls} />;
  if (type === 'note')        return <StickyNote className={cls} />;
  if (type === 'appointment') return <Calendar className={cls} />;
  return <FileText className={cls} />;
};

// ─── Single timeline entry ─────────────────────────────────────────────────────
const TimelineItem = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const owner = item.ownerName || '—';
  const dueDate = item.scheduledend || item.date;
  const dateStr = dueDate
    ? format(new Date(dueDate), 'dd/MM/yyyy HH:mm', { locale: es })
    : '';

  const bodyText = [item.subject, item.description].filter(Boolean).join('\n').trim();
  const preview  = bodyText.slice(0, 120);
  const hasMore  = bodyText.length > 120;

  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <Avatar name={owner} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-1">
          {item.scheduledend ? 'Fecha límite:' : 'Fecha:'} {dateStr}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <ActivityIcon type={item.type} />
          <span className="text-xs font-semibold text-foreground">{item.typeLabel}:</span>
          <span className="text-xs font-semibold text-primary">{owner}</span>
          {item.isOverdue && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: '#FEF2F2', color: '#DC2626' }}>
              Vencido
            </span>
          )}
          {item.isCompleted && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: '#F0FDF4', color: '#16A34A' }}>
              Completado
            </span>
          )}
          {item.statusLabel && !item.isOverdue && !item.isCompleted && (
            <span className="text-xs text-muted-foreground">({item.statusLabel})</span>
          )}
        </div>
        {bodyText && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {expanded ? bodyText : preview}
            {hasMore && !expanded && '…'}
          </p>
        )}
        {hasMore && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" /> Ver menos</> : <><ChevronDown className="h-3 w-3" /> Ver más</>}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Timeline panel ────────────────────────────────────────────────────────────
const Timeline = ({ items = [] }) => {
  const [search, setSearch] = useState('');

  const filtered = search
    ? items.filter(i =>
        [i.subject, i.description, i.ownerName, i.typeLabel]
          .filter(Boolean).some(s => s.toLowerCase().includes(search.toLowerCase()))
      )
    : items;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Timeline</h2>
        <span className="text-xs text-muted-foreground">{items.length} entradas</span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar en timeline…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {search ? 'Sin resultados.' : 'Sin actividad registrada.'}
          </p>
        ) : (
          filtered.map(item => <TimelineItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────
const CaseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    getCaseDetail(id)
      .then(setCaseData)
      .catch((err) => setError(err.response?.data?.error || 'Error al cargar el ticket'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/cases')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
      </Button>
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    </div>
  );

  const c = caseData;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="mt-0.5 flex-shrink-0" onClick={() => navigate('/cases')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground font-mono">{c.ticketnumber}</p>
          <h1 className="text-xl font-semibold mt-0.5 break-words">{c.title}</h1>
        </div>
      </div>

      {/* Two-column layout: details left, timeline right */}
      {/* On small screens becomes single column (details then timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── Left column: details + comments ── */}
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Detalles</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <CaseStatusBadge statecode={c.statecode} />
                  <StageBadge name={c.activeStage} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Prioridad"><PriorityBadge code={c.prioritycode} /></Field>
                <Field label="Tipo de caso">{c.caseTypeLabel}</Field>
                <Field label="Origen">{c.originLabel}</Field>
              </div>
              <Separator />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Cliente">{c.customerName}</Field>
                <Field label="Contacto">{c.contactName}</Field>
                <Field label="Usuario cliente">{c.customerUserName}</Field>
              </div>
              <Separator />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Categoría de servicio">{c.serviceCategoryName}</Field>
                <Field label="Sistema">{c.systemName}</Field>
                <Field label="Módulo">{c.moduleName}</Field>
              </div>
              <Separator />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Responsable">{c.ownerName}</Field>
                <Field label="Creado">
                  {c.createdon ? format(new Date(c.createdon), "dd 'de' MMMM yyyy", { locale: es }) : null}
                </Field>
                <Field label="Fecha de cierre">
                  {c.new_fechacierre ? format(new Date(c.new_fechacierre), "dd 'de' MMMM yyyy", { locale: es }) : null}
                </Field>
              </div>
              {c.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground text-xs mb-2">Descripción</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Comments (below details, left column) */}
          {c.comments?.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3">
                Comentarios ({c.comments.length})
              </h2>
              <div className="space-y-3">
                {c.comments.map((comment) => (
                  <Card key={comment.annotationid}>
                    <CardContent className="pt-4 pb-3">
                      {comment.subject && <p className="font-medium text-sm mb-1">{comment.subject}</p>}
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{comment.notetext}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {comment.createdon
                          ? format(new Date(comment.createdon), "dd MMM yyyy 'a las' HH:mm", { locale: es })
                          : ''}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: timeline ── */}
        <div className="lg:sticky lg:top-4">
          <Card className="h-full lg:max-h-[calc(100vh-120px)]">
            <CardContent className="pt-4 pb-4 h-full flex flex-col" style={{ minHeight: 400 }}>
              <Timeline items={c.timeline || []} />
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default CaseDetailPage;
