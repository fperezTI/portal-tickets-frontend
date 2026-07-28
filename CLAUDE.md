# Portal de Tickets — Frontend

SPA en React + Vite que consume la API del backend (`portal ticketsbackend`). Sin SSR, sin framework de meta (Next/Remix) — Vite puro + React Router.

## Stack

React 19, React Router v7, Vite, Tailwind v4 (config vía `@theme inline` en CSS, no `tailwind.config.js`), shadcn/ui (componentes en `src/components/ui/`, generados con Radix primitives), `react-hook-form` + `zod` para formularios, `i18next`/`react-i18next`, `date-fns`, `axios`, `lucide-react` para íconos, `sonner` para toasts.

## Estructura

```
src/
  api/          — un archivo por dominio (cases.js, policies.js, users.js, d365.js…), cada uno envuelve axios y devuelve r.data
  pages/        — una página por ruta; pages/admin/ son las rutas admin-only
  components/   — componentes compartidos entre páginas; components/ui/ es shadcn (no tocar el patrón interno de esos archivos)
  context/      — AuthContext (usuario, login/logout, refresh automático)
  hooks/        — useDateLocale (ver i18n abajo)
  i18n/         — index.js (init) + locales/es.json, en.json
  lib/utils.js  — cn() (clsx+tailwind-merge), fmtHours(), etc.
```

**Rutas** (`src/App.jsx`): cada página se importa con `React.lazy` + un `<Suspense>` alrededor de `<Routes>` — code-splitting por ruta. Si agregas una página nueva, impórtala igual (`const X = lazy(() => import('./pages/X'))`), no con `import` estático, o vuelves a inflar el bundle inicial para todos los roles.

`ProtectedRoute` exige sesión; `AdminRoute` (anidado dentro) exige `role === 'admin'`. El patrón para una página nueva de solo-admin es agregarla dentro del `<Route element={<AdminRoute />}>` en `App.jsx`.

## Diseño / marca

Colores de Grupo Staff definidos como CSS vars en `src/index.css` (`:root`): `--gs-navy` (#1B3860), `--gs-cyan` (#00B4CC), `--gs-orange` (#F47920). `--primary` del tema shadcn está mapeado al navy en modo claro — así que la mayoría de los botones/acentos "solo funcionan" sin tocar nada. Para un color de marca que no sea `--primary` (cyan, orange), se usa `style={{ color: 'var(--gs-cyan)' }}` inline, no clases de Tailwind — no hay `text-gs-cyan` generado.

Isotipo real en `public/isotipo.png` (la "X" de colores) y logo horizontal en `public/LOGO GS Azul_300.png` / `LOGO GS Color_240x54.png` (el de "Color" tiene texto azul marino oscuro — **no lo pongas sobre fondo oscuro**, el texto se pierde; ese fue justo el error a evitar en el rediseño del login).

Tipografía: system-ui vía Tailwind, sin fuente custom en el frontend (a diferencia de los documentos ejecutivos/artifacts generados en sesiones de Claude, que sí usan Constantia/Segoe/Consolas embebidas).

## Patrones de UI ya establecidos (reusar, no reinventar)

- **Tabla con grupos colapsables**: header de grupo (fila con fondo `bg-muted/30`, ícono `ChevronDown`/`ChevronRight`, clic para toggle, subtotal por mes) + filas hijas indentadas. Usado en `ConsumptionPage.jsx` (agrupado por etapa) y `MyPoliciesPage.jsx` (agrupado por Tipo de Soporte). Arrancan **contraídos** por default (`useEffect` que llena el `Set` de colapsados cuando llegan datos nuevos).
- **Tarjeta KPI**: `icon` + `value` grande + `label` chico, con `iconBg`/`iconColor`/`valueColor` parametrizables — hay una versión local por página (`KpiCard`) en vez de un componente compartido; si vas a crear una página con KPIs, copia el patrón de `GeneralConsumptionPage.jsx` o `ConsumptionPage.jsx`.
- **Resumen ejecutivo con barra de proporción**: fila con label + valor + `%` + barra horizontal de proporción (`HoursBreakdownRow` en `GeneralConsumptionPage.jsx`) — para mostrar composición (facturable/garantía/retrabajo) contra un total.
- **Combobox de búsqueda contra Dataverse** (`D365Combobox.jsx`): debounce de 350ms, mínimo 2 caracteres, soporta `entityType='contact'|'account'` y un `filterAccountId` opcional para acotar contactos a una empresa ya elegida. Reusa este componente para cualquier búsqueda nueva contra `contacts`/`accounts` — no armes un `<Select>` con fetch propio.

## i18n — específico de este proyecto, no es i18next "de libro"

**El idioma NO se detecta del navegador ni lo cambia el usuario con un botón** — es un atributo de la cuenta de portal (`new_language` en Dataverse), que un admin asigna en Usuarios. `AuthContext` tiene un `useEffect` que llama `i18n.changeLanguage(user?.language || 'es')` cada vez que cambia el usuario autenticado (cubre login y restauración de sesión).

**`LoginPage.jsx` está intencionalmente sin traducir** — antes de loguearse no se sabe el idioma del usuario, así que se dejó en español fijo (decisión explícita, no un olvido).

**Fechas**: nunca importes `es`/`enUS` de `date-fns/locale` directo — usa el hook `useDateLocale()`, que devuelve el locale correcto según `i18n.language`, y pásalo a cualquier `format(date, ..., { locale })`.

**Pluralización**: sufijos `_one`/`_other` en las claves (`t('key', { count })`), estándar de i18next.

**Gotcha real que pasó dos veces**: si agregas `const { t } = useTranslation()` a un componente que ya tiene un `.map((t) => ...)` en un loop, el `t` del loop tapa (shadowea) la función de traducción y rompe las traducciones silenciosamente dentro de ese bloque, sin error visible. Revisa nombres de variables de loop antes de agregar `useTranslation`.

## Convenciones de fetch de datos

Cada archivo en `src/api/` es delgado: `export const getX = (params) => client.get('/x', { params }).then((r) => r.data)`. `client` (en `api/client.js`) ya trae el interceptor de refresh automático de token — no dupliques esa lógica en un componente.

Filtros de página (año, mes, cliente seleccionado) viven en la **URL** (`useSearchParams`), no en `useState` suelto — así, si el usuario abre un detalle y vuelve, la lista no se resetea. Patrón repetido en `ConsumptionPage.jsx`, `MyPoliciesPage.jsx`, `GeneralConsumptionPage.jsx`, `MyPoliciesPage.jsx`.

## Qué mirar antes de reusar esto como base de un proyecto nuevo

- Genérico y reutilizable tal cual: el patrón de rutas lazy + `ProtectedRoute`/`AdminRoute`, el combobox de búsqueda con debounce, las tablas con grupos colapsables, el patrón de filtros-en-URL, y toda la arquitectura de i18n "idioma = atributo de cuenta".
- Específico de Grupo Staff (hay que reemplazar): los tres colores de marca y los assets de logo en `public/`, y cualquier copy/texto en español-por-default que asuma el dominio de "tickets de soporte" (títulos de página, labels de negocio).
