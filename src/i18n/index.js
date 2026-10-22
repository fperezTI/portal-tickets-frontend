import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';

// El idioma no se detecta del navegador: lo define el campo Idioma del
// usuario en el portal (asignado por un admin), aplicado al iniciar sesión
// desde AuthContext. Antes de conocer al usuario (login) se usa el idioma
// RECORDADO en este navegador por el último inicio de sesión, o ESPAÑOL si no
// hay ninguno (2026-10-10: se regresó al login de Grupo Staff conservando el
// idioma recordado — decisión del usuario). localStorage puede fallar (modo
// privado, bloqueado): en ese caso simplemente no se recuerda.
const LANG_KEY = 'portal-language';
const SUPPORTED = ['es', 'en'];

export const getRememberedLanguage = () => {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return SUPPORTED.includes(v) ? v : 'es';
  } catch {
    return 'es';
  }
};

export const rememberLanguage = (lang) => {
  if (!SUPPORTED.includes(lang)) return;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* sin almacenamiento: no se recuerda */ }
};

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: getRememberedLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
