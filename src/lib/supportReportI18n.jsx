// Textos de la hoja imprimible del Reporte de soporte (SupportReportPage) en
// español e inglés — copia de portal-auditoria-frontend. La hoja sigue su
// propio selector "Idioma del reporte" (arranca en el idioma del usuario); los
// filtros/botones/avisos de la página van en el i18n del portal (react-i18next).

export const SHEET_TEXT = {
  es: {
    title: 'SOPORTE ESPECIALIZADO',
    pdfName: 'Soporte Especializado',
    months: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    policyHoursByMonth: 'Horas contratadas por mes',
    policy: 'Póliza',
    policies: 'Pólizas',
    noPolicy: 'Sin póliza',
    total: 'Total',
    kpiPolicy: 'Contratadas', // horas de póliza / bolsa (nombre elegido por el usuario, 2026-10-02)
    kpiSupport: 'Consumidas', // horas billable descontadas del saldo
    kpiBalance: 'Saldo',
    ticketsByModule: 'Tickets por módulo',
    noTicketsInPeriod: 'Sin tickets en el periodo.',
    noModule: 'Sin módulo',
    statusTicket: 'Estatus / Ticket',
    customerUserTicket: 'Customer user / Ticket',
    // Encabezados cortos de la matriz (opción elegida por el usuario,
    // 2026-10-02), explicados en la leyenda al pie (columnsLegend).
    hours: 'Trab.',
    billable: 'Cons.',
    columnsLegend: 'Trab. = horas trabajadas · Cons. = horas consumidas (se descuentan del saldo)',
    // Solo clientes "Cierre" (pedido del usuario, 2026-10-06).
    cierreNote: 'Las horas de cada ticket se agrupan en el mes de cierre del ticket.',
    warranty: 'Garantía',
    noHoursInPeriod: 'Sin horas registradas en el periodo.',
    noCustomerUser: 'Sin customer user',
    ticketCount: (n) => `${n} ${n === 1 ? 'ticket' : 'tickets'}`,
    warrantyNote: (hours) => (
      <>Los tickets marcados como <strong>Garantía</strong> no se descuentan del saldo de la póliza ({hours} h).</>
    ),
  },
  en: {
    title: 'SPECIALIZED SUPPORT',
    pdfName: 'Specialized Support',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    policyHoursByMonth: 'Contracted hours by month',
    policy: 'Policy',
    policies: 'Policies',
    noPolicy: 'No policy',
    total: 'Total',
    kpiPolicy: 'Contracted',
    kpiSupport: 'Used',
    kpiBalance: 'Balance',
    ticketsByModule: 'Tickets by module',
    noTicketsInPeriod: 'No tickets in the period.',
    noModule: 'No module',
    statusTicket: 'Status / Ticket',
    customerUserTicket: 'Customer user / Ticket',
    hours: 'Wkd.',
    billable: 'Used',
    columnsLegend: 'Wkd. = hours worked · Used = hours used (deducted from the balance)',
    cierreNote: "Each ticket's hours are grouped in the month the ticket was closed.",
    warranty: 'Warranty',
    noHoursInPeriod: 'No hours recorded in the period.',
    noCustomerUser: 'No customer user',
    ticketCount: (n) => `${n} ${n === 1 ? 'ticket' : 'tickets'}`,
    warrantyNote: (hours) => (
      <>Tickets marked as <strong>Warranty</strong> are not deducted from the policy balance ({hours} h).</>
    ),
  },
};

// Etapas del proceso del caso (el backend manda la etapa original en inglés en
// `stage`; en español se usa `status`, que ya viene traducido).
export const STAGE_EN = {
  'Open Case': 'Open',
  Approval: 'Approval',
  'In Progress': 'In progress',
  Waiting: 'Waiting',
  Testing: 'Testing',
  Resolve: 'Resolving',
  Closed: 'Closed',
  Other: 'Other',
};

// Módulos (entidad cre2f_area de Dynamics, 24 registros al 2026-10-01) con su
// nombre estándar de Dynamics 365 en inglés. Si se agrega un módulo nuevo en
// Dynamics y no está aquí, el reporte en inglés lo muestra tal cual (en español)
// hasta que se agregue a esta lista.
export const MODULE_EN = {
  'Activos fijos': 'Fixed assets',
  'Administración de inventario': 'Inventory management',
  'Administración de la organización': 'Organization administration',
  'Administración del sistema': 'System administration',
  'Adquisición y abastecimiento': 'Procurement and sourcing',
  'Cadena de suministro': 'Supply chain',
  'Contabilidad general': 'General ledger',
  'Cuentas por cobrar': 'Accounts receivable',
  'Cuentas por pagar': 'Accounts payable',
  Fortia: 'Fortia',
  General: 'General',
  'Gestión de almacenes': 'Warehouse management',
  'Gestión de bancos': 'Cash and bank management',
  'Gestión de información de productos': 'Product information management',
  Impuesto: 'Tax',
  Nominas: 'Payroll',
  'Ordenes de trabajo': 'Work orders',
  'Planeación maestra': 'Master planning',
  Presupuesto: 'Budgeting',
  'Producción': 'Production control',
  Proyectos: 'Project management',
  'Recursos humanos': 'Human resources',
  'Ventas y marketing': 'Sales and marketing',
  'Viajes y cargos': 'Travel and expenses',
};
