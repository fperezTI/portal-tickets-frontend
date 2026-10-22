import { cn } from '@/lib/utils';
import { getBrand } from '@/lib/brand';

// Logo de la marca (Grupo Staff / Satustec). `variant`:
//   - 'header'  → logo horizontal para fondo claro (barra superior).
//   - 'report'  → logo de la hoja imprimible del reporte de Consumo.
//   - 'isotipo' → símbolo cuadrado para el menú (fondo azul marino).
// `onDark` con 'header': usa el logo blanco (`whiteLogo`) si la marca lo tiene.
// Si la marca no tiene el archivo, dibuja el nombre como texto con los
// colores de marca (respaldo; hoy ambas marcas tienen sus logos).
const SRC_BY_VARIANT = { header: 'headerLogo', report: 'reportLogo', isotipo: 'isotipo' };

const BrandLogo = ({ brand: brandKey, variant = 'header', className, style, onDark = false }) => {
  const brand = getBrand(brandKey);
  const src = (onDark && variant === 'header' && brand.whiteLogo) || brand[SRC_BY_VARIANT[variant] ?? 'headerLogo'];
  if (src) return <img src={src} alt={brand.name} className={cn('object-contain', className)} style={style} />;

  if (variant === 'isotipo') {
    return (
      <span
        className={cn('inline-flex items-center justify-center rounded-md font-black text-white leading-none', className)}
        style={{ background: brand.colors.accent }}
        aria-label={brand.name}
      >
        {brand.name.charAt(0)}
      </span>
    );
  }
  return (
    <span className={cn('inline-flex flex-col items-center leading-none select-none', className)} aria-label={brand.name}>
      <span className="font-black tracking-tight text-2xl" style={{ color: onDark ? '#FFFFFF' : brand.colors.navy }}>
        {brand.name.toUpperCase().split('').map((ch, i) => (
          <span key={i} style={ch === 'E' ? { color: brand.colors.accent } : undefined}>{ch}</span>
        ))}
      </span>
      {brand.key === 'satustec' && (
        <span className="text-[8px] font-semibold tracking-[0.45em] mt-1" style={{ color: onDark ? '#FFFFFF' : brand.colors.navy }}>SYSTEMS</span>
      )}
    </span>
  );
};

export default BrandLogo;
