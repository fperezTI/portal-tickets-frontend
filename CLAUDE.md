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

- **Tabla con grupos colapsables**: header de grupo (fila con fondo `bg-muted/30`, ícono `ChevronDown`/`ChevronRight`, clic para toggle, subtotal por mes) + filas hijas indentadas. Usado en `MyPoliciesPage.jsx` (agrupado por Tipo de Soporte). Arrancan **contraídos** por default (`useEffect` que llena el `Set` de colapsados cuando llegan datos nuevos).
- **Tarjeta KPI**: `icon` + `value` grande + `label` chico, con `iconBg`/`iconColor`/`valueColor` parametrizables — hay una versión local por página (`KpiCard`) en vez de un componente compartido; si vas a crear una página con KPIs, copia el patrón de `GeneralConsumptionPage.jsx` (o `SummaryCard` de `SupportReportPage.jsx`, versión compacta).
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

Filtros de página (año, mes, cliente seleccionado) viven en la **URL** (`useSearchParams`), no en `useState` suelto — así, si el usuario abre un detalle y vuelve, la lista no se resetea. Patrón repetido en `SupportReportPage.jsx`, `MyPoliciesPage.jsx`, `GeneralConsumptionPage.jsx`, `MyPoliciesPage.jsx`.

## Consumo = Reporte de soporte (`SupportReportPage.jsx`, `/consumption`, 2026-10-06)

**La página "Consumo" anterior (`ConsumptionPage.jsx`, horas billables por ticket y mes) se eliminó del frontend** (decisión del usuario): el menú "Consumo" (ícono `BarChart3`) y la ruta `/consumption` ahora abren este reporte, con título "Consumo". `/support-report` (ruta original) redirige a `/consumption` conservando `?client=&year=`. Los endpoints `/api/consumption*` del backend se conservaron (ver CLAUDE.md del backend) aunque el frontend ya no los usa; si se recupera la página, está en el historial de git.

Port de `CustomerSupportPage.jsx` de `portal-auditoria-frontend` (ver su `CLAUDE.md`, párrafos "Reporte de soporte", y el `CLAUDE.md` del backend para las reglas). Menú "Consumo" para los 3 roles (antes "Reporte de soporte" junto a la Consumo vieja). Igual que en auditoría: tarjetas Contratadas/Consumidas/Saldo, tabla de horas contratadas por póliza + Total, módulos en lista compacta, matriz Estatus/Customer user × mes con columnas Trab./Cons. y leyenda, "Meses del reporte" (acota toda la hoja y el PDF, client-side; **solo admin**, ver abajo), "Agrupar tickets por", "Idioma del reporte", PDF con `window.print()` (carta horizontal, `<style>` propio con `@media print`) y Excel "Support's Tickets" (`src/lib/supportTicketsExcel.js`, `exceljs` con import dinámico — queda en su propio chunk). Textos de la hoja en `src/lib/supportReportI18n.jsx` (copia de auditoría, incluidos los 24 módulos `MODULE_EN`).

Diferencias con auditoría:
- **Client**: sin buscador ni selector de cliente (el backend usa su JWT); solo año. Sin leyenda bajo el título (se quitó para todos los roles, 2026-10-06). Tiene Agrupar e Imprimir / PDF. **"Exportar a Excel" solo lo ve admin** (pedido del usuario, 2026-10-07; antes lo veían los 3 roles) — support y client no tienen el botón. Los avisos internos (fuera de vigencia, tickets Cierre pendientes) solo se renderizan para staff y además el backend no se los manda. El aviso "sin pólizas activas" de auditoría se quitó para todos los roles (decisión del usuario, 2026-10-06); la hoja sigue mostrando la fila "Sin póliza" en 0. **Sin selector "Idioma del reporte"**: la hoja, el PDF y el Excel salen siempre en el idioma de su usuario del portal (`user.language`, decisión del usuario, 2026-10-06). **"Meses del reporte" solo lo ve admin** (decisión del usuario, 2026-10-06): client y support no tienen esos botones y siempre ven el periodo completo (hoja, PDF y Excel).
- **Sin logo de cliente**: a la derecha del encabezado va el nombre del cliente; logo de Grupo Staff = `public/LOGO GS Color_240x54.png`.
- **i18n**: filtros, botones y avisos en `supportReport.*` (mensajes de carga en `loading.supportReport`) de `locales/*.json` (no en español fijo). "Idioma del reporte" (solo staff) arranca en `user.language` y solo cambia la hoja. Los botones de mes usan el idioma de la interfaz.
- **Encabezado** (2026-10-06): título a la izquierda y, a su nivel a la derecha, filtros + Exportar a Excel + Imprimir / PDF (para todos los roles); si no caben junto al título, bajan de línea alineados a la derecha. Ningún control lleva etiqueta visible (Cliente, Año, Agrupar, Idioma: solo `aria-label` + tooltip) para que el encabezado suba. Sin leyenda para ningún rol. Separación entre controles `gap-2` para que en staff quepan en una línea junto al título.
- **Tarjetas de resumen** (2026-10-06, solo pantalla, no salen en el PDF; el periodo de "Horas facturables" va en el idioma de la interfaz, no en el del reporte): mismo estilo que las de Consumo pero más compactas (`SummaryCard`). Respetan los meses elegidos: Horas facturables = Consumidas de la hoja (sin garantía); Tickets con consumo = tickets de la tabla (incluye garantía, = "Total (N tickets)"); Horas de garantía = billable de garantía; Promedio h / ticket = consumidas ÷ tickets sin garantía; Horas disponibles = Saldo de la hoja (rojo si es negativo) — NO el saldo de toda la vida de la póliza que usa Consumo (decisiones del usuario).
- **Todos los filtros en la URL** (2026-10-07): `?client=&year=` más `&months=` (solo se respeta para admin), `&group=customerUser` y `&lang=` (solo staff; sin el parámetro = idioma del usuario). Cambiar cliente o año borra `months`.
- **Clic en un ticket de la matriz** (2026-10-07): toda la fila del ticket (número/título, cualquier celda de mes y sus totales) abre `/cases/:id` en la misma pestaña, para los 3 roles (Enter también). Como los filtros están en la URL, el botón Regresar del ticket (`navigate(-1)`) vuelve a la hoja exactamente igual. Las filas de grupo y de Total no abren nada. Un client solo ve tickets de su empresa, que el backend ya le deja abrir (`isCaseOwner`).
- Selector de cliente: `<select>` nativo sobre la lista del backend (solo cuentas con actividad en el año) — deliberadamente NO `D365Combobox`, que busca en todas las cuentas. Sin campo "Buscar cliente" (se quitó, pedido del usuario 2026-10-06; la lista nativa salta al cliente tecleando su nombre).

**Impresión** (aplica a cualquier página que use `window.print()`): `Layout.jsx` oculta sidebar y header (`print:hidden`) y quita `overflow`/padding del área de contenido (`print:overflow-visible print:p-0`) — sin eso, el PDF sale recortado a la altura de la pantalla. `--good-bg` (tarjeta Saldo) está en `index.css`.

## Qué mirar antes de reusar esto como base de un proyecto nuevo

- Genérico y reutilizable tal cual: el patrón de rutas lazy + `ProtectedRoute`/`AdminRoute`, el combobox de búsqueda con debounce, las tablas con grupos colapsables, el patrón de filtros-en-URL, y toda la arquitectura de i18n "idioma = atributo de cuenta".
- Específico de Grupo Staff (hay que reemplazar): los tres colores de marca y los assets de logo en `public/`, y cualquier copy/texto en español-por-default que asuma el dominio de "tickets de soporte" (títulos de página, labels de negocio).

## Mensajes de carga "Procesando información" (2026-10-06)

`src/components/LoadingMessages.jsx`: `LoadingCard` (tarjeta con mensajes formales que rotan al azar cada 3 s) y `LoadingOverlay` (envuelve los `Skeleton` de una ventana y pone la tarjeta flotando encima — decisión del usuario: se conservan los bloques grises para que el diseño no brinque). Textos en `loading.*` de `locales/*.json`: `title` + un juego por ventana (`dashboard`, `generalConsumption`, `policies`, `policyHours`, `policyDetail`, `supportReport`). Solo en las ventanas que tardan (Inicio, Consumo General, Mis Pólizas y su panel de horas por mes, Detalle de póliza, Consumo/Reporte de soporte) — en las rápidas (listas de tickets, usuarios, tareas) la tarjeta solo parpadearía; ahí siguen solo los `Skeleton`. Ventana nueva pesada: agregar su juego en `loading.<set>` (ES y EN, mismos mensajes) y envolver su skeleton con `<LoadingOverlay set="...">`.

## Menú por rol (2026-10-07)

"Tareas" (`/admin/tasks`) se quitó del menú para todos (pedido del usuario, 2026-10-07); la página y su ruta siguen existiendo para admin por URL directa. "Mis Pólizas" se quitó del menú de los clientes (pedido del usuario): `NAV_ITEMS` de `Layout.jsx` solo deja "Pólizas" (`/policies/mine`) para admin/support. La ruta `/policies/mine` sigue existiendo y un cliente que entre por URL directa todavía la ve (solo se ocultó la entrada del menú; el backend sigue sirviendo `/policies/mine` a clientes).
