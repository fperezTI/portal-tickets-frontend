import { useTranslation } from 'react-i18next';
import { es, enUS } from 'date-fns/locale';

// date-fns necesita su propio objeto de locale (para nombres de mes/día) —
// se deriva del idioma activo de i18next, no se configura por separado.
export const useDateLocale = () => {
  const { i18n } = useTranslation();
  return i18n.language === 'en' ? enUS : es;
};

// Patrones de fecha por idioma (date-fns). El locale solo traduce los nombres
// de mes; el ORDEN y el reloj cambian aquí: español "19 nov 2026, 14:30",
// inglés (EE. UU.) "Nov 19, 2026, 2:30 PM".
const PATTERNS = {
  es: {
    date:            'dd MMM yyyy',
    dayMonth:        'dd MMM',
    dateTime:        'dd MMM yyyy HH:mm',
    numericDateTime: 'dd/MM/yyyy HH:mm',
  },
  en: {
    date:            'MMM d, yyyy',
    dayMonth:        'MMM d',
    dateTime:        'MMM d, yyyy h:mm a',
    numericDateTime: 'MM/dd/yyyy h:mm a',
  },
};

// `locale` = el objeto que devuelve useDateLocale().
export const datePattern = (locale, kind) => PATTERNS[locale === enUS ? 'en' : 'es'][kind];
