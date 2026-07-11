import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import {
  getPolicyDetail, getAllocationSuggestions, listAllocations, createAllocations, deactivateAllocation,
  deactivateAllocationsForDetail, updatePolicyStatus,
} from '../api/policies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft, ClipboardList, Loader2, Check, Undo2, ChevronDown, ChevronRight, Power, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { fmtHours, cn } from '@/lib/utils';

// ─── Badge de estado ───────────────────────────────────────────────────────────
const StatusBadge = ({ statecode }) => {
  const active = statecode === 0;
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
      style={active
        ? { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }
        : { background: '#F4F4F5', color: '#71717A', border: '1px solid #E4E4E7' }}
    >
      {active ? 'Activa' : 'Inactiva'}
    </span>
  );
};

// ─── Campo genérico de detalle ─────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div>
    <p className="text-muted-foreground text-xs mb-1">{label}</p>
    <div className="text-sm font-medium">{children || <span className="text-muted-foreground font-normal">—</span>}</div>
  </div>
);

// Dataverse expone estos campos como "solo fecha"; reconstruir con `new Date(iso)`
// puede recorrer un día por la zona horaria del navegador. Se usa el valor ya
// formateado por Dataverse (M/D/YYYY, el mismo que muestra Customer Service) y
// solo se reordena a la convención visual de la app, sin pasar por Date/UTC.
const parseUSDate = (str) => {
  if (!str) return null;
  const [m, d, y] = str.split('/').map(Number);
  return new Date(y, m - 1, d);
};
const fmtDate = (str) => {
  const date = parseUSDate(str);
  return date ? format(date, 'dd MMM yyyy', { locale: es }) : null;
};

// El backend expone la fecha límite de la tarea sin ambigüedad de huso horario
// como clave "YYYY-MM-DD" (no un ISO con hora) — se formatea igual que fmtDate
// pero sin pasar por new Date(iso).
const fmtDayKey = (key) => {
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'dd MMM yyyy', { locale: es });
};

// "YYYY-MM" -> "diciembre 2025"
const fmtMonthKey = (key) => {
  if (!key) return null;
  const [y, m] = key.split('-').map(Number);
  return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: es });
};

const UNMATCHED_REASON_LABEL = {
  no_period:   'Sin periodo que coincida con su fecha límite',
  no_duedate:  'La tarea no tiene fecha límite',
  no_capacity: 'Sin capacidad disponible en ningún periodo posterior',
};

// ─── Panel de asignación de un detalle específico (expandido bajo su fila) ────
// Los tickets sugeridos ya vienen ordenados por el backend por fecha de
// creación del ticket (el más antiguo primero) — esa es también la prioridad
// con la que se les asignaron las horas cuando la capacidad del periodo no
// alcanza para todos.
const DetailAllocationPanel = ({ detail, suggestions, accepted, hoursOverride, setHoursOverride, busyKeys, onAccept, onAcceptAll, onUndo, onUnassignAll }) => {
  const key = (s) => `${s.ticketId}|${s.supportPolicyDetailId}`;
  const isFull = detail.statecode === 1;

  // Suma en vivo — refleja los valores editados en los inputs, no solo la
  // sugerencia original del backend.
  const totalSuggestedHours = suggestions.reduce(
    (sum, s) => sum + (parseFloat(hoursOverride[key(s)] ?? s.suggestedHours) || 0), 0
  );

  return (
    <div className="space-y-4 py-3">
      {isFull && (
        <p className="text-xs font-medium text-muted-foreground">
          Este detalle ya completó sus horas disponibles y quedó marcado como Inactivo.
        </p>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">
            Tickets propuestos ({suggestions.length})
            {suggestions.length > 0 && (
              <span className="ml-2 font-normal text-muted-foreground">· {fmtHours(totalSuggestedHours)}h en total</span>
            )}
          </p>
          {suggestions.length > 0 && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onAcceptAll(suggestions)} disabled={busyKeys.has('__all__')}>
              {busyKeys.has('__all__') ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              Aceptar todas
            </Button>
          )}
        </div>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No hay horas billables pendientes de asignar a este detalle.</p>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s) => {
              const k = key(s);
              return (
                <div
                  key={k}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2.5 flex-wrap',
                    s.isWarranty ? 'bg-amber-50 border-amber-200' : 'bg-background'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate flex items-center gap-1.5">
                      {s.isWarranty && <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                      {s.ticketNumber || s.ticketId}
                      {s.ticketTitle && <span className="ml-1.5 font-normal text-muted-foreground">— {s.ticketTitle}</span>}
                    </p>
                    {s.month && (
                      <p className="text-xs text-muted-foreground capitalize">{fmtMonthKey(s.month)}</p>
                    )}
                    {s.isWarranty ? (
                      <p className="text-xs text-amber-700">Ticket de garantía — se vincula sin consumir horas de la póliza</p>
                    ) : s.acceptedHours > 0 && (
                      <p className="text-xs text-muted-foreground">{fmtHours(s.acceptedHours)}h ya aceptadas en este detalle</p>
                    )}
                  </div>
                  {s.isWarranty ? (
                    <span className="text-xs font-medium text-amber-700 w-20 text-center">0h</span>
                  ) : (
                    <>
                      <Input
                        type="number"
                        step="0.25"
                        min="0.01"
                        value={hoursOverride[k] ?? s.suggestedHours}
                        onChange={(e) => setHoursOverride((prev) => ({ ...prev, [k]: e.target.value }))}
                        className="h-8 w-20 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">h</span>
                    </>
                  )}
                  <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => onAccept(s)} disabled={busyKeys.has(k)}>
                    {busyKeys.has(k) ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                    Aceptar
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Asignados a este detalle ({accepted.length})</p>
          {accepted.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={onUnassignAll}
              disabled={busyKeys.has('__unassign_all__')}
            >
              {busyKeys.has('__unassign_all__') ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Undo2 className="mr-1.5 h-3.5 w-3.5" />}
              Desasignar todas
            </Button>
          )}
        </div>
        {accepted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Aún no hay horas asignadas a este detalle.</p>
        ) : (
          <div className="space-y-1.5">
            {accepted.map((a) => (
              <div
                key={a.id}
                className={cn('flex items-center justify-between gap-2 rounded-lg border p-2.5', a.isWarranty ? 'bg-amber-50 border-amber-200' : 'bg-background')}
              >
                <div className="min-w-0">
                  <span className="text-sm font-bold inline-flex items-center gap-1.5">
                    {a.isWarranty && <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                    {a.ticketNumber || a.ticketId}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">{fmtHours(a.hours)}h · {a.createdByName || '—'}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => onUndo(a)} disabled={busyKeys.has(a.id)}>
                  {busyKeys.has(a.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const STAFF_ROLES = ['admin', 'support'];

// ─── Página ────────────────────────────────────────────────────────────────────
const PolicyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  // Confirmación en un modal propio (centrado, sin encabezado del navegador)
  // en vez de window.confirm — se usa como Promise<boolean> para no cambiar
  // la forma en que el resto del código ya la consume.
  const [confirmState, setConfirmState] = useState(null); // { message, resolve }
  const askConfirm = (message) => new Promise((resolve) => setConfirmState({ message, resolve }));
  const resolveConfirm = (ok) => { confirmState?.resolve(ok); setConfirmState(null); };

  // Regresa al historial (conserva el cliente/filtros ya elegidos en la
  // lista de pólizas) en vez de forzar siempre una carga fresca de /policies/mine.
  const handleBack = () => {
    if (window.history.length > 2) navigate(-1);
    else navigate('/policies/mine');
  };

  const fetchPolicy = useCallback(() => (
    getPolicyDetail(id)
      .then(setPolicy)
      .catch((err) => setError(err.response?.data?.error || 'Error al cargar la póliza'))
      .finally(() => setLoading(false))
  ), [id]);

  useEffect(() => { fetchPolicy(); }, [fetchPolicy]);

  const handleToggleStatus = async () => {
    const activating = policy.statecode !== 0;
    const msg = activating
      ? `¿Reactivar la póliza ${policy.name}?`
      : `¿Desactivar la póliza ${policy.name}? Dejará de estar disponible para nuevas asignaciones de horas.`;
    if (!(await askConfirm(msg))) return;
    setStatusBusy(true);
    try {
      const updated = await updatePolicyStatus(id, activating);
      setPolicy((prev) => ({ ...prev, statecode: updated.statecode }));
      toast.success(activating ? 'Póliza reactivada' : 'Póliza desactivada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cambiar el estado de la póliza');
    } finally {
      setStatusBusy(false);
    }
  };

  // ─── Datos de asignación (sugerencias + ledger), compartidos por todas las filas ──
  const [suggestions, setSuggestions] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [allocLoading, setAllocLoading] = useState(true);
  const [allocError, setAllocError] = useState('');
  const [hoursOverride, setHoursOverride] = useState({});
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showLinkedTickets, setShowLinkedTickets] = useState(false);

  const setBusy = (k, val) => setBusyKeys((prev) => {
    const next = new Set(prev);
    if (val) next.add(k); else next.delete(k);
    return next;
  });

  const refreshAllocations = useCallback(async () => {
    if (!isStaff) return;
    setAllocLoading(true);
    setAllocError('');
    try {
      const [sugRes, allocRes] = await Promise.all([
        getAllocationSuggestions(id),
        listAllocations(id),
      ]);
      setSuggestions(sugRes.suggestions || []);
      setUnmatched(sugRes.unmatched || []);
      setAllocations(allocRes || []);
    } catch (err) {
      setAllocError(err.response?.data?.error || 'Error al cargar las sugerencias de asignación');
    } finally {
      setAllocLoading(false);
    }
  }, [id, isStaff]);

  useEffect(() => { refreshAllocations(); }, [refreshAllocations]);

  const refreshAll = async () => { await Promise.all([refreshAllocations(), fetchPolicy()]); };

  const [recalcBusy, setRecalcBusy] = useState(false);
  const handleRecalculate = async () => {
    setRecalcBusy(true);
    try {
      await refreshAll();
      toast.success('Sugerencias recalculadas');
    } catch (err) {
      toast.error('Error al recalcular las sugerencias');
    } finally {
      setRecalcBusy(false);
    }
  };

  const suggestionsByDetail = useMemo(() => {
    const map = new Map();
    suggestions.forEach((s) => {
      if (!map.has(s.supportPolicyDetailId)) map.set(s.supportPolicyDetailId, []);
      map.get(s.supportPolicyDetailId).push(s);
    });
    return map;
  }, [suggestions]);

  const allocationsByDetail = useMemo(() => {
    const map = new Map();
    allocations.forEach((a) => {
      if (!map.has(a.supportPolicyDetailId)) map.set(a.supportPolicyDetailId, []);
      map.get(a.supportPolicyDetailId).push(a);
    });
    return map;
  }, [allocations]);

  // Tickets ya vinculados a la póliza (asignaciones aceptadas), agrupados
  // para la vista plana "Tickets vinculados a la póliza" — el mes/año y el
  // nombre del detalle se derivan de p.supportPolicies (no del periodLabel
  // de la asignación, que puede venir vacío si ese detalle ya está Inactivo).
  const linkedTickets = useMemo(() => {
    const detailById = new Map((policy?.supportPolicies || []).map((sp) => [sp.id, sp]));
    return allocations
      .map((a) => {
        const detail = detailById.get(a.supportPolicyDetailId);
        // El mes real del ticket (de la fecha límite de su tarea) se guarda al
        // aceptar la sugerencia. Las asignaciones creadas antes de ese cambio
        // no lo tienen — para esas se usa el mes del detalle como estimado.
        let monthKey = null;
        let monthEstimated = false;
        if (a.month) {
          const [y, m] = a.month.split('-').map(Number);
          monthKey = new Date(y, m - 1, 1);
        } else if (detail?.dateFormatted) {
          monthKey = parseUSDate(detail.dateFormatted);
          monthEstimated = true;
        }
        return { ...a, detailName: detail?.name || '—', monthKey, monthEstimated };
      })
      .sort((a, b) => {
        const ma = a.monthKey ? a.monthKey.getTime() : 0;
        const mb = b.monthKey ? b.monthKey.getTime() : 0;
        if (ma !== mb) return ma - mb;
        return (a.ticketNumber || '').localeCompare(b.ticketNumber || '');
      });
  }, [allocations, policy]);

  const handleAccept = async (s) => {
    const k = `${s.ticketId}|${s.supportPolicyDetailId}`;
    const hours = s.isWarranty ? 0 : parseFloat(hoursOverride[k] ?? s.suggestedHours);
    if (!s.isWarranty && !(hours > 0)) { toast.error('Las horas deben ser mayores a 0'); return; }
    setBusy(k, true);
    try {
      await createAllocations(id, [{ ticketId: s.ticketId, supportPolicyDetailId: s.supportPolicyDetailId, hours, month: s.month }]);
      toast.success(s.isWarranty ? `${s.ticketNumber || 'Ticket'} vinculado (garantía, 0h)` : `${hours}h asignadas a ${s.ticketNumber || 'ticket'}`);
      await refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al aceptar la asignación');
      if (err.response?.status === 409) await refreshAll();
    } finally {
      setBusy(k, false);
    }
  };

  const handleAcceptAll = async (detailSuggestions) => {
    if (!detailSuggestions.length) return;
    setBusy('__all__', true);
    try {
      await createAllocations(id, detailSuggestions.map((s) => ({
        ticketId: s.ticketId,
        supportPolicyDetailId: s.supportPolicyDetailId,
        hours: s.isWarranty ? 0 : parseFloat(hoursOverride[`${s.ticketId}|${s.supportPolicyDetailId}`] ?? s.suggestedHours),
        month: s.month,
      })));
      toast.success('Sugerencias aceptadas');
      await refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al aceptar las sugerencias');
      await refreshAll();
    } finally {
      setBusy('__all__', false);
    }
  };

  const handleUndo = async (allocation) => {
    setBusy(allocation.id, true);
    try {
      await deactivateAllocation(id, allocation.id);
      toast.success('Asignación deshecha');
      await refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al deshacer la asignación');
    } finally {
      setBusy(allocation.id, false);
    }
  };

  const handleUnassignAll = async (detailId, detailName) => {
    const ok = await askConfirm(`¿Desasignar todas las horas ya aceptadas del detalle ${detailName}? Esta acción no se puede deshacer individualmente.`);
    if (!ok) return;
    setBusy('__unassign_all__', true);
    try {
      const { deactivated } = await deactivateAllocationsForDetail(id, detailId);
      toast.success(`${deactivated} asignación(es) desasignadas`);
      await refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al desasignar las horas del detalle');
    } finally {
      setBusy('__unassign_all__', false);
    }
  };

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (error) return (
    <div className="max-w-xl space-y-4">
      <Button variant="ghost" size="sm" onClick={handleBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
      </Button>
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    </div>
  );

  const p = policy;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground font-mono">Póliza</p>
          <h1 className="text-xl font-semibold mt-0.5 break-words">{p.name}</h1>
        </div>
      </div>

      {/* Encabezado de la póliza */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Detalles</CardTitle>
            <div className="flex items-center gap-2">
              <StatusBadge statecode={p.statecode} />
              {isStaff && p.statecode === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleRecalculate}
                  disabled={recalcBusy}
                  title="Vuelve a calcular las sugerencias de asignación — útil después de activar una póliza nueva del mismo cliente"
                >
                  {recalcBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                  Recalcular sugerencias
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant={p.statecode === 0 ? 'outline' : 'secondary'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleToggleStatus}
                  disabled={statusBusy}
                >
                  {statusBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Power className="mr-1.5 h-3.5 w-3.5" />}
                  {p.statecode === 0 ? 'Desactivar póliza' : 'Reactivar póliza'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Field label="Fecha inicio">{fmtDate(p.startDateFormatted)}</Field>
            <Field label="Fecha vencimiento">{fmtDate(p.dueDateFormatted)}</Field>
            <Field label="Total de horas">
              {p.totalHours != null ? `${fmtHours(p.totalHours)} h` : null}
            </Field>
            <Field label="Horas usadas (tareas)">
              {p.consumedHours != null ? `${fmtHours(p.consumedHours)} h` : null}
            </Field>
            <Field label="Horas disponibles">
              {p.totalHours != null && p.consumedHours != null ? `${fmtHours(p.totalHours - p.consumedHours)} h` : null}
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Detalle: registros de Support Policy — al seleccionar uno (solo staff),
          se expande debajo con los tickets propuestos para ese periodo. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Registros de soporte
            <span className="text-xs font-normal text-muted-foreground">({p.supportPolicies.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allocError && (
            <div className="px-6 pt-2">
              <Alert variant="destructive"><AlertDescription>{allocError}</AlertDescription></Alert>
            </div>
          )}
          {p.supportPolicies.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Sin registros de soporte para esta póliza.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-y">
                  <tr>
                    {[isStaff ? '' : null, 'Id', 'Tipo', 'Fecha', 'Fecha fin', 'Horas', 'Asignado', 'Disponible', 'Comentarios', 'Estado']
                      .filter((h) => h !== null)
                      .map((h, i) => (
                        <th key={h || `col-${i}`} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap first:pl-6">
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {p.supportPolicies.map((sp) => {
                    const isExpanded = expandedId === sp.id;
                    const detailSuggestions = suggestionsByDetail.get(sp.id) || [];
                    const detailAllocations = allocationsByDetail.get(sp.id) || [];
                    return (
                      <Fragment key={sp.id}>
                        <tr
                          className={`transition-colors ${isStaff ? 'cursor-pointer hover:bg-muted/20' : 'hover:bg-muted/20'} ${isExpanded ? 'bg-muted/30' : ''}`}
                          onClick={isStaff ? () => setExpandedId(isExpanded ? null : sp.id) : undefined}
                        >
                          {isStaff && (
                            <td className="pl-6 pr-0 py-2.5 w-6">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </td>
                          )}
                          <td className={`py-2.5 font-bold whitespace-nowrap ${isStaff ? 'pr-4' : 'pl-6 pr-4'}`}>
                            {sp.name}
                            {detailSuggestions.length > 0 && (
                              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                                {detailSuggestions.length}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{sp.typeName || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(sp.dateFormatted) || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(sp.endDateFormatted) || '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{sp.hours != null ? fmtHours(sp.hours) : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{sp.allocatedHours != null ? `${fmtHours(sp.allocatedHours)}h` : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-medium">{sp.availableHours != null ? `${fmtHours(sp.availableHours)}h` : '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground max-w-[280px] truncate" title={sp.comments || ''}>
                            {sp.comments || '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge statecode={sp.statecode} />
                          </td>
                        </tr>
                        {isStaff && isExpanded && (
                          <tr key={`${sp.id}-panel`}>
                            <td colSpan={9} className="bg-muted/10 px-6 border-b">
                              {allocLoading ? (
                                <div className="space-y-2 py-3">
                                  {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                                </div>
                              ) : (
                                <DetailAllocationPanel
                                  detail={sp}
                                  suggestions={detailSuggestions}
                                  accepted={detailAllocations}
                                  hoursOverride={hoursOverride}
                                  setHoursOverride={setHoursOverride}
                                  busyKeys={busyKeys}
                                  onAccept={handleAccept}
                                  onAcceptAll={handleAcceptAll}
                                  onUndo={handleUndo}
                                  onUnassignAll={() => handleUnassignAll(sp.id, sp.name)}
                                />
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vista plana de todos los tickets ya vinculados (asignaciones aceptadas)
          a cualquier detalle de esta póliza — para ver de un vistazo qué se le
          ha asignado a la póliza completa, sin tener que abrir cada detalle. */}
      {isStaff && !allocLoading && linkedTickets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <button
              onClick={() => setShowLinkedTickets((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium hover:text-foreground"
            >
              {showLinkedTickets ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Tickets vinculados a la póliza ({linkedTickets.length})
            </button>
          </CardHeader>
          {showLinkedTickets && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-y">
                    <tr>
                      {['Ticket', 'Título', 'Mes y año', 'Horas', 'Detalle'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap first:pl-6">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {linkedTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                        <td className="pl-6 pr-4 py-2.5 font-bold whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {t.isWarranty && <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                            {t.ticketNumber || t.ticketId}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[320px] truncate" title={t.ticketTitle || ''}>
                          {t.ticketTitle || '—'}
                        </td>
                        <td
                          className="px-4 py-2.5 text-muted-foreground whitespace-nowrap capitalize"
                          title={t.monthEstimated ? 'Estimado a partir del detalle — esta asignación se aceptó antes de guardar el mes real del ticket' : undefined}
                        >
                          {t.monthKey ? format(t.monthKey, 'MMMM yyyy', { locale: es }) : '—'}
                          {t.monthEstimated && <span className="text-xs">*</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtHours(t.hours)}h</td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{t.detailName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Tickets con horas billables que no calzan con ningún periodo (sin fecha
          límite, fuera de rango, o sin capacidad en ningún periodo posterior). */}
      {isStaff && !allocLoading && unmatched.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <button
              onClick={() => setShowUnmatched((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium hover:text-foreground"
            >
              {showUnmatched ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Tickets sin periodo asignable ({unmatched.length})
            </button>
          </CardHeader>
          {showUnmatched && (
            <CardContent className="space-y-1.5">
              {unmatched.map((u, i) => (
                <div key={i} className="text-xs text-muted-foreground rounded border border-dashed p-2 flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium text-foreground">{u.ticketNumber || u.ticketId}</span> — {fmtHours(u.hours)}h
                    {u.dueDate && <span className="ml-1.5">· venc. {fmtDayKey(u.dueDate)}</span>}
                  </span>
                  <span>{UNMATCHED_REASON_LABEL[u.reason] || u.reason}</span>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      <Dialog open={!!confirmState} onOpenChange={(o) => { if (!o) resolveConfirm(false); }}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <p className="text-sm">{confirmState?.message}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => resolveConfirm(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => resolveConfirm(true)}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PolicyDetailPage;
