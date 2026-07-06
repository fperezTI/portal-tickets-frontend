import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import {
  getPolicyDetail, getAllocationSuggestions, listAllocations, createAllocations, deactivateAllocation,
} from '../api/policies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft, ClipboardList, Split, Loader2, Check, Undo2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { fmtHours } from '@/lib/utils';

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
const fmtDate = (str) => {
  if (!str) return null;
  const [m, d, y] = str.split('/').map(Number);
  return format(new Date(y, m - 1, d), 'dd MMM yyyy', { locale: es });
};

const UNMATCHED_REASON_LABEL = {
  no_period:   'Sin periodo que coincida con su fecha límite',
  no_duedate:  'La tarea no tiene fecha límite',
  no_capacity: 'Sin capacidad disponible en ningún periodo posterior',
};

// ─── Asignación de horas (sugerencias -> aceptar -> ledger) ───────────────────
const AllocationCard = ({ policyId, onAllocationChange }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoursOverride, setHoursOverride] = useState({});
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [showUnmatched, setShowUnmatched] = useState(false);

  const key = (s) => `${s.ticketId}|${s.supportPolicyDetailId}`;
  const setBusy = (k, val) => setBusyKeys((prev) => {
    const next = new Set(prev);
    if (val) next.add(k); else next.delete(k);
    return next;
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sugRes, allocRes] = await Promise.all([
        getAllocationSuggestions(policyId),
        listAllocations(policyId),
      ]);
      setSuggestions(sugRes.suggestions || []);
      setUnmatched(sugRes.unmatched || []);
      setAllocations(allocRes || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar las sugerencias de asignación');
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Además de refrescar sugerencias/asignaciones (internas de esta card), avisa
  // a la página para que vuelva a pedir la póliza — así "Registros de soporte"
  // (Asignado/Disponible) no se queda con datos obsoletos tras aceptar/deshacer.
  const refreshAll = async () => { await Promise.all([refresh(), onAllocationChange?.()]); };

  const handleAccept = async (s) => {
    const k = key(s);
    const hours = parseFloat(hoursOverride[k] ?? s.suggestedHours);
    if (!(hours > 0)) { toast.error('Las horas deben ser mayores a 0'); return; }
    setBusy(k, true);
    try {
      await createAllocations(policyId, [{ ticketId: s.ticketId, supportPolicyDetailId: s.supportPolicyDetailId, hours }]);
      toast.success(`${hours}h asignadas a ${s.ticketNumber || 'ticket'}`);
      await refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al aceptar la asignación');
      if (err.response?.status === 409) await refreshAll();
    } finally {
      setBusy(k, false);
    }
  };

  const handleAcceptAll = async () => {
    if (!suggestions.length) return;
    setBusy('__all__', true);
    try {
      await createAllocations(policyId, suggestions.map((s) => ({
        ticketId: s.ticketId,
        supportPolicyDetailId: s.supportPolicyDetailId,
        hours: parseFloat(hoursOverride[key(s)] ?? s.suggestedHours),
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
      await deactivateAllocation(policyId, allocation.id);
      toast.success('Asignación deshecha');
      await refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al deshacer la asignación');
    } finally {
      setBusy(allocation.id, false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Split className="h-4 w-4 text-muted-foreground" />
            Asignación de horas
          </CardTitle>
          {suggestions.length > 0 && (
            <Button size="sm" className="h-8 text-xs" onClick={handleAcceptAll} disabled={busyKeys.has('__all__')}>
              {busyKeys.has('__all__') ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              Aceptar todas
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <>
            {/* Sugerencias */}
            <div>
              <p className="text-sm font-medium mb-2">Sugerencias pendientes ({suggestions.length})</p>
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">No hay horas billables pendientes de asignar a un periodo.</p>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s) => {
                    const k = key(s);
                    return (
                      <div key={k} className="flex items-center gap-3 rounded-lg border p-2.5 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{s.ticketNumber || s.ticketId}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.periodLabel}
                            {s.acceptedHours > 0 && <span className="ml-1.5">· {fmtHours(s.acceptedHours)}h ya aceptadas</span>}
                          </p>
                        </div>
                        <Input
                          type="number"
                          step="0.25"
                          min="0.01"
                          value={hoursOverride[k] ?? s.suggestedHours}
                          onChange={(e) => setHoursOverride((prev) => ({ ...prev, [k]: e.target.value }))}
                          className="h-8 w-20 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                        <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => handleAccept(s)} disabled={busyKeys.has(k)}>
                          {busyKeys.has(k) ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                          Aceptar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {unmatched.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowUnmatched((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showUnmatched ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Sin periodo ({unmatched.length})
                  </button>
                  {showUnmatched && (
                    <div className="mt-2 space-y-1.5">
                      {unmatched.map((u, i) => (
                        <div key={i} className="text-xs text-muted-foreground rounded border border-dashed p-2 flex items-center justify-between gap-2">
                          <span><span className="font-medium text-foreground">{u.ticketNumber || u.ticketId}</span> — {u.hours}h</span>
                          <span>{UNMATCHED_REASON_LABEL[u.reason] || u.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Asignaciones aceptadas */}
            <div>
              <p className="text-sm font-medium mb-2">Asignaciones aceptadas ({allocations.length})</p>
              {allocations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">Aún no hay horas asignadas a periodos de esta póliza.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-y">
                      <tr>
                        {['Ticket', 'Periodo', 'Horas', 'Creado por', 'Fecha', ''].map((h) => (
                          <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap first:pl-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allocations.map((a) => (
                        <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                          <td className="pl-4 pr-3 py-2 font-bold whitespace-nowrap">{a.ticketNumber || a.ticketId}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{a.periodLabel || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtHours(a.hours)}h</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{a.createdByName || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {a.createdOn ? format(new Date(a.createdOn), 'dd MMM yyyy', { locale: es }) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleUndo(a)} disabled={busyKeys.has(a.id)}>
                              {busyKeys.has(a.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const STAFF_ROLES = ['admin', 'support'];

// ─── Página ────────────────────────────────────────────────────────────────────
const PolicyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPolicy = useCallback(() => (
    getPolicyDetail(id)
      .then(setPolicy)
      .catch((err) => setError(err.response?.data?.error || 'Error al cargar la póliza'))
      .finally(() => setLoading(false))
  ), [id]);

  useEffect(() => { fetchPolicy(); }, [fetchPolicy]);

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (error) return (
    <div className="max-w-xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/policies/mine')}>
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
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => navigate('/policies/mine')}>
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
            <StatusBadge statecode={p.statecode} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Field label="Fecha inicio">{fmtDate(p.startDateFormatted)}</Field>
            <Field label="Fecha vencimiento">{fmtDate(p.dueDateFormatted)}</Field>
            <Field label="Precio unitario">
              {p.unitPrice != null ? `${p.unitPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${p.currency || ''}` : null}
            </Field>
            <Field label="Total de horas">
              {p.totalHours != null ? `${fmtHours(p.totalHours)} h` : null}
            </Field>
            <Field label="Horas usadas (tareas)">
              {p.consumedHours != null ? `${fmtHours(p.consumedHours)} h` : null}
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Detalle: registros de Support Policy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Registros de soporte
            <span className="text-xs font-normal text-muted-foreground">({p.supportPolicies.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {p.supportPolicies.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Sin registros de soporte para esta póliza.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-y">
                  <tr>
                    {['Id', 'Tipo', 'Fecha', 'Fecha fin', 'Horas', 'Asignado', 'Disponible', 'Comentarios', 'Estado'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap first:pl-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {p.supportPolicies.map((sp) => (
                    <tr key={sp.id} className="hover:bg-muted/20 transition-colors">
                      <td className="pl-6 pr-4 py-2.5 font-bold whitespace-nowrap">{sp.name}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asignación de horas: sugerencias por periodo + ledger de asignaciones */}
      {isStaff && <AllocationCard policyId={id} onAllocationChange={fetchPolicy} />}
    </div>
  );
};

export default PolicyDetailPage;
