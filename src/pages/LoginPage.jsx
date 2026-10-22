import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Layers, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { getBrand, setTab } from '@/lib/brand';

// Login con el diseño de Grupo Staff (2026-10-10: el usuario pidió regresar al
// diseño anterior tras probar un login neutro multi-empresa). Lo que se
// conserva del cambio: los textos van en i18n (`login.*`) y salen en el idioma
// RECORDADO del último usuario que entró en este navegador — español si no hay
// ninguno (ver i18n/index.js). Ya dentro, cada usuario ve la marca de su
// empresa (Grupo Staff / Satustec, ver AuthContext). Los colores son los de
// Grupo Staff fijos (var(--gs-*)): sin sesión no hay data-brand, así que
// :root = Grupo Staff.
//
// Login de Satustec (2026-10-10, ruta /loginst → <LoginPage brand="satustec" />):
// MISMO funcionamiento y estructura, con los colores y el estilo de Satustec
// (data-brand="satustec" en el contenedor: botón rojo, foco rojo) y SIEMPRE en
// inglés (decisión del usuario; solo esta pantalla — ya dentro, cada usuario ve
// su idioma). Cualquier usuario puede entrar por cualquiera de los dos; ya
// dentro ve la marca de SU empresa. A quien se queda sin sesión se le manda al
// login de la empresa recordada en el navegador (getLoginPath en brand.js).
const LOGIN_THEMES = {
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

const LoginPage = ({ brand: brandKey = 'grupostaff' }) => {
  const brand = getBrand(brandKey);
  const theme = LOGIN_THEMES[brand.key];
  const { t: tUser, i18n } = useTranslation();
  // Satustec: textos SIEMPRE en inglés sin tocar el idioma global (el
  // recordado sigue aplicando en /login y ya dentro del portal).
  const t = useMemo(
    () => (theme.fixedLanguage ? i18n.getFixedT(theme.fixedLanguage) : tUser),
    [theme.fixedLanguage, i18n, tUser],
  );

  // Pestaña del navegador de esta pantalla de login (Grupo Staff: la de siempre).
  useEffect(() => {
    setTab(brand.documentTitle[theme.fixedLanguage || 'es'], brand.favicon);
  }, [brand, theme.fixedLanguage]);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // El esquema se arma con t() para que los mensajes salgan en el idioma actual.
  const schema = useMemo(() => z.object({
    email:    z.string().email(t('login.invalidEmail')),
    password: z.string().min(1, t('login.passwordRequired')),
  }), [t]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  // Los mensajes del backend vienen en español fijo; aquí se traducen por
  // código de respuesta para que el login respete su idioma.
  const loginErrorMessage = (err) => {
    const status = err.response?.status;
    if (status === 401) return t('login.invalidCredentials');
    if (status === 403) return t('login.inactiveUser');
    if (status === 429) return t('login.tooManyAttempts');
    return t('login.genericError');
  };

  const onSubmit = async ({ email, password }) => {
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
    }
  };

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

          {/* Heading */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('login.welcome')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('login.subtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">{t('login.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('login.emailPlaceholder')}
                  autoComplete="email"
                  className="h-11 pl-10"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t('login.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete="current-password"
                  className="h-11 pl-10 pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('login.signingIn') : t('login.signIn')}
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

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

export default LoginPage;
