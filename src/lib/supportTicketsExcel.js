// Exportación a Excel "Support's Tickets" del Reporte de soporte (pedido del
// usuario, 2026-10-06): mismas columnas y orden que su tabla de Power BI.
// Decisiones del usuario: Hours = horas reales de las tareas (sin el ajuste
// "Billable > Horas" de la hoja, igual que Power BI: Diff puede ser negativo);
// solo los meses seleccionados en "Meses del reporte"; encabezados según el
// idioma del reporte; Warranty = cre2f_iswarranty (el mismo de la hoja).
// exceljs se carga solo al exportar (import dinámico) para no pesar en la página.

const TEXT = {
  es: {
    sheet: 'Tickets de soporte',
    title: 'Tickets de soporte',
    headers: ['Cant.', 'Ticket', 'Título', 'Prioridad', 'Origen', 'Garantía', 'Usuario', 'Consultor', 'Creado', 'Cerrado', 'Horas', 'Billable', 'Dif.', 'Resuelto por usuario', 'Descripción', 'Resolución'],
    yes: 'Sí',
    no: 'No',
    fileName: 'Tickets de soporte',
    // Dynamics devuelve los valores de opción en inglés (idioma del usuario de
    // la API); en el Excel en español se traducen los conocidos.
    values: {
      High: 'Alta', Normal: 'Normal', Low: 'Baja', Critical: 'Crítica',
      Email: 'Correo', Phone: 'Teléfono', Web: 'Web',
    },
  },
  en: {
    sheet: "Support's Tickets",
    title: "Support's Tickets",
    headers: ['Count', 'Case Number', 'Case Title', 'Priority', 'Origin', 'Warranty', 'User', 'Consultant', 'Created On', 'Closed on', 'Hours', 'Billable', 'Diff', 'User Resolve', 'Description', 'Resolution'],
    yes: 'Yes',
    no: 'No',
    fileName: "Support's Tickets",
    values: {},
  },
};

const WIDTHS = [7, 18, 45, 10, 11, 10, 26, 26, 12, 12, 9, 9, 9, 10, 60, 60];
const NUM_COLS = [11, 12, 13]; // Hours, Billable, Diff (1-based)
const DATE_COLS = [9, 10];
const NAVY = 'FF0B3A6E';
const STRIPE = 'FFE8EEF7';

const r2 = (n) => Math.round(n * 100) / 100;
const toDate = (dayKey) => (dayKey ? new Date(`${dayKey}T00:00:00Z`) : null);

// Una fila por ticket con horas o billable en los meses elegidos.
export const buildSupportTicketRows = (report, months) => report.statuses
  .flatMap((s) => s.tickets)
  .map((tk) => {
    const hours = r2(months.reduce((a, m) => a + (tk.rawHours?.[m] ?? 0), 0));
    const billable = r2(months.reduce((a, m) => a + (tk.months?.[m]?.billable ?? 0), 0));
    return { tk, hours, billable, diff: r2(hours - billable) };
  })
  .filter((r) => r.hours > 0 || r.billable > 0)
  .sort((a, b) => (a.tk.ticketNumber || '').localeCompare(b.tk.ticketNumber || ''));

export const exportSupportTicketsExcel = async ({ report, months, monthsLabel, lang }) => {
  const { default: ExcelJS } = await import('exceljs');
  const t = TEXT[lang] ?? TEXT.es;
  const tr = (v) => (v == null ? '' : t.values[v] ?? v);
  const yesNo = (v) => (v == null ? '' : v ? t.yes : t.no);
  const rows = buildSupportTicketRows(report, months);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t.sheet, { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.columns = WIDTHS.map((width) => ({ width }));

  ws.mergeCells(1, 1, 1, 6);
  const title = ws.getCell(1, 1);
  title.value = t.title;
  title.font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.getRow(1).height = 22;

  const header = ws.getRow(2);
  header.values = t.headers;
  header.height = 30;
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  rows.forEach(({ tk, hours, billable, diff }, i) => {
    const row = ws.addRow([
      1, tk.ticketNumber, tk.title, tr(tk.priority), tr(tk.origin), yesNo(tk.isWarranty),
      tk.customerUser ?? '', tk.consultant ?? '', toDate(tk.createdOn), toDate(tk.closedOn),
      hours, billable, diff, yesNo(tk.userResolve),
      // Una sola línea por fila, como en Power BI.
      (tk.description || '').replace(/\s+/g, ' ').trim(),
      (tk.resolution || '').replace(/\s+/g, ' ').trim(),
    ]);
    if (i % 2 === 1) row.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } }; });
    if (tk.isWarranty) row.getCell(6).font = { bold: true, color: { argb: 'FFB45309' } };
  });

  // Totales (Count = número de tickets), como la última fila de Power BI.
  const first = 3;
  const last = 2 + rows.length;
  const sum = (col) => (rows.length ? { formula: `SUM(${col}${first}:${col}${last})`, result: r2(rows.reduce((a, r) => a + ({ K: r.hours, L: r.billable, M: r.diff })[col], 0)) } : 0);
  const total = ws.addRow([rows.length ? { formula: `SUM(A${first}:A${last})`, result: rows.length } : 0, '', '', '', '', '', '', '', null, null, sum('K'), sum('L'), sum('M')]);
  total.eachCell({ includeEmpty: true }, (c) => {
    c.font = { bold: true };
    c.border = { top: { style: 'medium', color: { argb: NAVY } } };
  });

  for (let r = first; r <= last + 1; r++) {
    NUM_COLS.forEach((col) => { ws.getCell(r, col).numFmt = '0.00'; });
    DATE_COLS.forEach((col) => { ws.getCell(r, col).numFmt = 'dd/mm/yyyy'; });
    ws.getCell(r, 1).alignment = { horizontal: 'center' };
    [4, 5, 6, 9, 10, 14].forEach((col) => { ws.getCell(r, col).alignment = { horizontal: 'center' }; });
  }
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: t.headers.length } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${t.fileName} - ${report.customer.name} - ${monthsLabel}.xlsx`.replace(/[\\/:*?"<>|]/g, '-');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return rows.length;
};
