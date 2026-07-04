import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPolicyDetail } from '../api/policies';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ClipboardList } from 'lucide-react';

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

// ─── Página ────────────────────────────────────────────────────────────────────
const PolicyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPolicyDetail(id)
      .then(setPolicy)
      .catch((err) => setError(err.response?.data?.error || 'Error al cargar la póliza'))
      .finally(() => setLoading(false));
  }, [id]);

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Fecha inicio">{fmtDate(p.startDateFormatted)}</Field>
            <Field label="Fecha vencimiento">{fmtDate(p.dueDateFormatted)}</Field>
            <Field label="Precio unitario">
              {p.unitPrice != null ? `${p.unitPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${p.currency || ''}` : null}
            </Field>
            <Field label="Total de horas">
              {p.totalHours != null ? `${p.totalHours} h` : null}
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
                    {['Id', 'Tipo', 'Fecha', 'Fecha fin', 'Horas', 'Comentarios', 'Estado'].map((h) => (
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
                      <td className="px-4 py-2.5 whitespace-nowrap">{sp.hours != null ? sp.hours : '—'}</td>
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
    </div>
  );
};

export default PolicyDetailPage;
