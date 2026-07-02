import { Badge } from '@/components/ui/badge';

const STATUS = {
  0: { label: 'Activo',    variant: 'default' },
  1: { label: 'Resuelto',  variant: 'secondary' },
  2: { label: 'Cancelado', variant: 'outline' },
};

const CaseStatusBadge = ({ statecode }) => {
  const { label, variant } = STATUS[statecode] ?? { label: 'Desconocido', variant: 'outline' };
  return <Badge variant={variant}>{label}</Badge>;
};

export default CaseStatusBadge;
