import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ArrowUp, ArrowDown, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResizableColumns } from '../hooks/useResizableColumns';

/**
 * Tabla genérica con orden y filtro por columna (ícono en el encabezado) y
 * columnas redimensionables. Cada columna se define como:
 *   {
 *     key:        string único
 *     label:      texto del encabezado
 *     accessor:   (row) => valor comparable/filtrable (string | number | Date | null)
 *     render:     (row) => JSX de la celda (opcional; por defecto muestra accessor(row))
 *     sortable:   boolean (default true)
 *     filterType: 'text' | 'select' | 'none' (default 'text')
 *     width:      ancho inicial en px
 *     className:  clases extra para <td> (whitespace, truncate, etc.)
 *   }
 *
 * El filtrado/orden se aplica sobre `data` (lo ya cargado en memoria) — el
 * paginado "cargar más" de cada página sigue funcionando igual por fuera.
 */
const compareValues = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date || b instanceof Date) return new Date(a) - new Date(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
};

const ColumnFilter = ({ col, data, value, onChange }) => {
  const [query, setQuery] = useState('');

  const distinctValues = useMemo(() => {
    if (col.filterType !== 'select') return [];
    const set = new Set();
    data.forEach((row) => {
      const v = col.accessor(row);
      if (v !== null && v !== undefined && v !== '') set.add(v);
    });
    return [...set].sort((a, b) => compareValues(a, b));
  }, [data, col]);

  const isActive = col.filterType === 'text' ? !!value : !!(value && value.size > 0);

  if (col.filterType === 'none') return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'ml-1 shrink-0 rounded p-0.5 hover:bg-muted-foreground/10 transition-colors',
            isActive ? 'text-primary' : 'text-muted-foreground/50'
          )}
        >
          <ListFilter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {col.filterType === 'select' ? (
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {distinctValues.length === 0 && (
              <p className="text-xs text-muted-foreground px-1 py-2">Sin valores</p>
            )}
            {distinctValues.map((v) => {
              const checked = !value || value.has(v);
              return (
                <label key={String(v)} className="flex items-center gap-2 px-1 py-1 text-xs rounded hover:bg-muted/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = value ? new Set(value) : new Set(distinctValues);
                      if (checked) next.delete(v); else next.add(v);
                      onChange(next.size === distinctValues.length ? null : next);
                    }}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate">{String(v)}</span>
                </label>
              );
            })}
            {isActive && (
              <button
                onClick={() => onChange(null)}
                className="text-xs text-primary hover:underline px-1 pt-1"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              autoFocus
              placeholder={`Buscar en ${col.label}…`}
              value={query || value || ''}
              onChange={(e) => { setQuery(e.target.value); onChange(e.target.value || null); }}
              className="h-8 text-xs"
            />
            {isActive && (
              <button
                onClick={() => { setQuery(''); onChange(null); }}
                className="text-xs text-primary hover:underline"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

const DataTable = ({ columns, data, getRowKey, getRowClassName, getRowTitle, onRowClick, maxHeight = 'calc(100vh-320px)' }) => {
  const defaultWidths = useMemo(() => {
    const w = {};
    columns.forEach((c) => { w[c.label] = c.width || 150; });
    return w;
  }, [columns]);
  const { widths, startResize } = useResizableColumns(defaultWidths);

  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [filters, setFilters] = useState({});

  const toggleSort = (col) => {
    if (col.sortable === false) return;
    setSort((prev) => {
      if (prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return { key: null, dir: 'asc' };
    });
  };

  const setFilter = (col, value) => setFilters((prev) => ({ ...prev, [col.key]: value }));

  const visibleData = useMemo(() => {
    let rows = data;

    // Filtros
    for (const col of columns) {
      const value = filters[col.key];
      if (!value) continue;
      if (col.filterType === 'select') {
        rows = rows.filter((row) => value.has(col.accessor(row)));
      } else {
        const q = String(value).toLowerCase();
        rows = rows.filter((row) => String(col.accessor(row) ?? '').toLowerCase().includes(q));
      }
    }

    // Orden
    if (sort.key) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        rows = [...rows].sort((a, b) => {
          const cmp = compareValues(col.accessor(a), col.accessor(b));
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return rows;
  }, [data, filters, sort, columns]);

  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%' }}>
        <colgroup>
          {columns.map((c) => <col key={c.key} style={{ width: widths[c.label] }} />)}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur border-b">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="relative overflow-hidden text-left px-4 py-3 font-medium text-muted-foreground first:pl-6"
              >
                <div className="flex items-center gap-1 pr-2">
                  <span
                    className={cn('inline-flex items-center gap-1 min-w-0', col.sortable !== false && 'cursor-pointer select-none hover:text-foreground')}
                    onClick={() => toggleSort(col)}
                  >
                    <span className="truncate">{col.label}</span>
                    {col.sortable !== false && (
                      sort.key === col.key
                        ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />)
                        : <ArrowUp className="h-3 w-3 shrink-0 opacity-20" />
                    )}
                  </span>
                  <ColumnFilter
                    col={col}
                    data={data}
                    value={filters[col.key]}
                    onChange={(v) => setFilter(col, v)}
                  />
                </div>
                <div
                  onMouseDown={startResize(col.label)}
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none hover:bg-primary/30 active:bg-primary/50"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {visibleData.map((row) => (
            <tr
              key={getRowKey(row)}
              className={cn('transition-colors', onRowClick && 'cursor-pointer', getRowClassName ? getRowClassName(row) : 'hover:bg-muted/30')}
              title={getRowTitle ? getRowTitle(row) : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={cn('px-4 py-3', i === 0 && 'pl-6', col.className)}
                >
                  {col.render ? col.render(row) : (col.accessor(row) ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {visibleData.length === 0 && data.length > 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Sin resultados con los filtros de columna aplicados.
        </div>
      )}
    </div>
  );
};

export default DataTable;
