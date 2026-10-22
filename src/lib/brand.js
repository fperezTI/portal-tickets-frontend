// Marcas del corporativo (Grupo Staff / Satustec) — diseño multi-empresa,
// 2026-10-07. La empresa del usuario llega del backend en `user.company`
// (cliente: la de su cuenta; staff: la de su usuario). Los DATOS son
// compartidos; aquí solo vive la marca.
//
// Dos capas, con los mismos valores:
//   - CSS: variables --brand-* y tokens de shadcn en src/index.css, por
//     atributo data-brand (lo pone AuthContext en <html>; el reporte de Consumo
//     lo pone en su hoja con la empresa DEL CLIENTE).
//   - JS (este archivo): logos, títulos y colores en hex para lo que no puede
//     leer variables CSS (gráficas SVG, Excel).
// Grupo Staff conserva exactamente los valores que ya tenía el portal.

export const DEFAULT_BRAND = 'grupostaff';

export const BRANDS = {
  grupostaff: {
    key: 'grupostaff',
    name: 'Grupo Staff',
    portalTitleKey: 'common.portalTitle',
    documentTitle: { es: 'Portal de Tickets - Grupo Staff', en: 'Ticket Portal - Grupo Staff' },
    favicon: '/PortalticketsColor.png',
    loginPath: '/login',
    isotipo: '/isotipo.png',                     // menú (sobre fondo azul marino)
    headerLogo: '/LOGO%20GS%20Color_240x54.png', // barra superior (fondo blanco)
    reportLogo: '/LOGO%20GS%20Color_240x54.png', // hoja imprimible del reporte
    colors: {
      navy: '#1B3860',
      accent: '#00B4CC',
      loading: '#0B3A6E',     // tarjeta "Procesando información"
      excelHeader: 'FF0B3A6E', // ARGB para exceljs
    },
  },
  satustec: {
    key: 'satustec',
    name: 'Satustec',
    portalTitleKey: 'common.portalTitleSatustec',
    documentTitle: { es: 'Portal de Soporte - Satustec', en: 'Support Portal - Satustec' },
    favicon: '/ISO%20SATUSTEC2026-18.png',
    // Login propio de Satustec (2026-10-10): mismo funcionamiento que /login,
    // con colores de Satustec y siempre en inglés (ver LoginPage brand="satustec").
    loginPath: '/loginst',
    // Logos oficiales entregados por el usuario (2026-10-10), PNG con fondo
    // transparente en public/ (los nombres traen espacios → %20).
    isotipo: '/ISO%20SATUSTEC2026-18.png',            // símbolo (menú y pestaña)
    headerLogo: '/LOGOS%20SATUSTEC2026A-17.png',      // a color, fondo claro
    reportLogo: '/LOGOS%20SATUSTEC2026A-17.png',
    whiteLogo: '/LOGO%20BCO%20SATUSTEC2026-19.png',   // blanco + E roja, fondo oscuro (/loginst)
    colors: {
      navy: '#121A2E',
      accent: '#FF3131',
      loading: '#121A2E',
      excelHeader: 'FF121A2E',
    },
  },
};

export const getBrand = (key) => BRANDS[key] || BRANDS[DEFAULT_BRAND];

// ─── Empresa recordada en el navegador (2026-10-10) ──────────────────────────
// Al iniciar sesión se guarda la empresa del usuario (AuthContext). Sirve para
// saber a qué login mandar a alguien SIN sesión (cerró sesión, se le venció o
// abrió un enlace): Satustec → /loginst, Grupo Staff → /login (decisión del
// usuario: "según su empresa"). Sin nada recordado → /login. localStorage
// puede fallar (modo privado): entonces se usa /login.
const COMPANY_KEY = 'portal-company';

export const rememberCompany = (company) => {
  if (!BRANDS[company]) return;
  try { localStorage.setItem(COMPANY_KEY, company); } catch { /* sin almacenamiento */ }
};

export const getRememberedCompany = () => {
  try {
    const v = localStorage.getItem(COMPANY_KEY);
    return BRANDS[v] ? v : DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
};

// Ruta del login al que debe ir quien no tiene sesión.
export const getLoginPath = () => getBrand(getRememberedCompany()).loginPath;

// Título e ícono de la pestaña del navegador.
export const setTab = (title, faviconHref) => {
  document.title = title;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = faviconHref.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  link.href = faviconHref;
};
