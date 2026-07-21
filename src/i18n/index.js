import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';

// El idioma no se detecta del navegador: lo define el campo Idioma del
// usuario en el portal (asignado por un admin), aplicado al iniciar sesión
// desde AuthContext. Español es el default hasta que se conozca el usuario.
i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
