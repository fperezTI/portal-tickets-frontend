import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { getBrand } from '@/lib/brand';

// Marco de las pantallas de autenticación (2026-11-23): panel de marca a la
// izquierda + tarjeta a la derecha. Sale tal cual de LoginPage (que se ve
// idéntico) para reusarlo en "¿Olvidaste tu contraseña?", "Crear nueva
// contraseña" y el cambio obligatorio del primer ingreso, cada una con la
// marca que le toca (Grupo Staff / Satustec).
//
// Temas por empresa. `fixedLanguage`: el login de Satustec (/loginst) va
// SIEMPRE en inglés (decisión del usuario); las pantallas que conocen el
// idioma del usuario lo pasan explícito a useAuthT.
export const LOGIN_THEMES = {
  grupostaff: {
    panelBg: 'linear-gradient(150deg, var(--gs-navy) 0%, oklch(0.19 0.07 258) 100%)',
    accent: 'var(--gs-cyan)',
    formBg: 'oklch(0.97 0.004 258)',
    footerKey: 'login.footer',
    fixedLanguage: null,
  },
  satustec: {
    panelBg: 'linear-gradient(150deg, #121A2E 0%, #0A0F1D 100%)',
    accent: '#FF3131',
    formBg: '#F5F6F8',
    footerKey: 'login.footerSatustec',
    fixedLanguage: 'en',
  },
};

// t() de una pantalla de autenticación: `language` explícito (idioma del
// usuario) > idioma fijo de la marca (Satustec = inglés) > idioma global
// (el recordado del navegador). No toca el idioma global.
export const useAuthT = (brandKey, language = null) => {
  const { t: tUser, i18n } = useTranslation();
  const lang = language || LOGIN_THEMES[getBrand(brandKey).key].fixedLanguage;
  return useMemo(() => (lang ? i18n.getFixedT(lang) : tUser), [lang, i18n, tUser]);
};

const AuthShell = ({ brandKey = 'grupostaff', t, children }) => {
  const brand = getBrand(brandKey);
  const theme = LOGIN_THEMES[brand.key];
  const features = t('login.features', { returnObjects: true });

  return (
    <div className="min-h-screen flex" data-brand={brand.key === 'satustec' ? 'satustec' : undefined}>

      {/* ── Panel izquierdo — branding de la empresa ── */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: theme.panelBg,
        }}
      >
        {/* Logo */}
        {brand.key === 'satustec' ? (
          <div className="relative z-10">
            <BrandLogo brand="satustec" variant="header" onDark className="h-10 w-auto" />
          </div>
        ) : (
          <div className="relative z-10 flex items-center gap-3">
            <img src="/isotipo.png" alt="" className="w-9 h-9 shrink-0 object-contain" />
            <div className="leading-tight">
              <p className="text-white font-bold text-base tracking-tight">GRUPO STAFF</p>
              <p className="text-[10px] tracking-wider" style={{ color: 'oklch(1 0 0 / 0.5)' }}>
                BUSINESS PROCESS &amp; IT CONSULTING
              </p>
            </div>
          </div>
        )}

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold font-display text-white leading-tight tracking-tight">
            {t('login.panelTitleLine1')}<br />
            <span style={{ color: theme.accent }}>{t('login.panelTitleLine2')}</span>
          </h1>
          <p style={{ color: 'oklch(1 0 0 / 0.55)' }} className="text-base leading-relaxed max-w-xs">
            {t('login.tagline')}
          </p>

          {/* Features */}
          <div className="space-y-3 pt-2">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: theme.accent }}
                />
                <span className="text-sm" style={{ color: 'oklch(1 0 0 / 0.60)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] relative z-10" style={{ color: 'oklch(1 0 0 / 0.25)' }}>
          {t(theme.footerKey, { year: new Date().getFullYear() })}
        </p>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: theme.formBg }}>
        <div className="w-full max-w-sm bg-card border rounded-2xl shadow-xl p-8 space-y-8">

          {/* Mobile logo */}
          <div className="lg:hidden">
            {brand.key === 'satustec' ? (
              <BrandLogo brand="satustec" variant="header" className="h-10 w-auto" style={{ maxWidth: 200 }} />
            ) : (
              <img
                src="/LOGO%20GS%20Azul_300.png"
                alt="Grupo Staff"
                className="h-10 w-auto object-contain"
                style={{ maxWidth: '200px' }}
              />
            )}
          </div>

          {children}

          {/* Powered by */}
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Layers className="h-3 w-3" /> {t('login.poweredBy')}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
