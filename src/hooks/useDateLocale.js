import { useTranslation } from 'react-i18next';
import { es, enUS } from 'date-fns/locale';

// date-fns necesita su propio objeto de locale (para nombres de mes/día) —
// se deriva del idioma activo de i18next, no se configura por separado.
export const useDateLocale = () => {
  const { i18n } = useTranslation();
  return i18n.language === 'en' ? enUS : es;
};
