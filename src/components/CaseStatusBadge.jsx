import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

const STATUS_KEY = {
  0: { key: 'status.active',    variant: 'default' },
  1: { key: 'status.resolved',  variant: 'secondary' },
  2: { key: 'status.cancelled', variant: 'outline' },
};

const CaseStatusBadge = ({ statecode }) => {
  const { t } = useTranslation();
  const { key, variant } = STATUS_KEY[statecode] ?? { key: 'status.unknown', variant: 'outline' };
  return <Badge variant={variant}>{t(key)}</Badge>;
};

export default CaseStatusBadge;
