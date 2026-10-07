import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tarjeta "Procesando información" con mensajes formales que rotan en orden
// aleatorio cada 3 s, sin repetir el mismo dos veces seguidas (port de
// portal-auditoria-frontend). `set` = juego de mensajes de la ventana en el
// i18n (`loading.<set>`: dashboard, consumption, generalConsumption, policies,
// policyHours, policyDetail, supportReport). Solo en las ventanas que tardan;
// las rápidas siguen solo con sus Skeleton.
const NAVY = '#0B3A6E';
const ROTATE_MS = 3000;

const randomIndex = (len, prev) => {
  let i;
  do { i = Math.floor(Math.random() * len); } while (i === prev && len > 1);
  return i;
};

export const LoadingCard = ({ set, className }) => {
  const { t } = useTranslation();
  const messages = t(`loading.${set}`, { returnObjects: true });
  const [idx, setIdx] = useState(() => randomIndex(messages.length, -1));
  useEffect(() => {
    const timer = setInterval(() => setIdx((p) => randomIndex(messages.length, p)), ROTATE_MS);
    return () => clearInterval(timer);
  }, [messages.length]);
  return (
    <div role="status" aria-live="polite"
      className={cn('flex w-fit max-w-md items-center gap-3 rounded-md border bg-white px-5 py-3 shadow-lg print:hidden', className)}
      style={{ borderColor: NAVY }}>
      <Loader2 className="h-5 w-5 shrink-0 animate-spin" style={{ color: NAVY }} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('loading.title')}</p>
        <p key={idx} className="text-sm font-medium animate-in fade-in duration-500" style={{ color: NAVY }}>{messages[idx % messages.length]}</p>
      </div>
    </div>
  );
};

// Envuelve los Skeleton de una ventana y pone la tarjeta flotando encima
// (decisión del usuario: se conservan los bloques grises para que el diseño no
// brinque al terminar de cargar).
export const LoadingOverlay = ({ set, children, className }) => (
  <div className={cn('relative', className)}>
    {children}
    <div className="absolute inset-0 z-10 flex items-start justify-center pt-6 pointer-events-none print:hidden">
      <LoadingCard set={set} />
    </div>
  </div>
);
