import { useState, useRef, useCallback } from 'react';

const MIN_WIDTH = 60;

/**
 * Anchos de columna editables por el usuario (arrastrando el borde del <th>).
 * `initialWidths` es un objeto { columnLabel: px }; las columnas sin entrada
 * se dejan sin ancho fijo (auto).
 */
export const useResizableColumns = (initialWidths) => {
  const [widths, setWidths] = useState(initialWidths);
  const dragRef = useRef(null);

  const startResize = useCallback((colName) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { colName, startX: e.clientX, startWidth: widths[colName] ?? 150 };

    const onMouseMove = (moveEvent) => {
      if (!dragRef.current) return;
      const { colName, startX, startWidth } = dragRef.current;
      const next = Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX));
      setWidths((prev) => ({ ...prev, [colName]: next }));
    };
    const onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [widths]);

  return { widths, startResize };
};
