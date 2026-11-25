import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import AuthShell, { LOGIN_THEMES, useAuthT } from '../components/AuthShell';
import MfaStep from '../components/MfaStep';
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
//
// 2026-11-23: el marco (panel de marca + tarjeta) y los temas se movieron a
// components/AuthShell.jsx, para reusarlos en las pantallas de contraseña.
//
// 2026-11-24: usuarios con verificación en dos pasos → después de la
// contraseña, el mismo marco muestra MfaStep (código enviado al correo).
const LoginPage = ({ brand: brandKey = 'grupostaff' }) => {
  const brand = getBrand(brandKey);
  const theme = LOGIN_THEMES[brand.key];
  // Satustec: textos SIEMPRE en inglés sin tocar el idioma global (el
  // recordado sigue aplicando en /login y ya dentro del portal).
  const t = useAuthT(brand.key);

  // Pestaña del navegador de esta pantalla de login (Grupo Staff: la de siempre).
  useEffect(() => {
    setTab(brand.documentTitle[theme.fixedLanguage || 'es'], brand.favicon);
  }, [brand, theme.fixedLanguage]);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Respuesta del login cuando falta el código de verificación.
  const [challenge, setChallenge] = useState(null);

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
    if (err.response?.data?.code === 'TEMP_PASSWORD_EXPIRED') return t('login.tempPasswordExpired');
    if (err.response?.data?.code === 'MFA_SEND_FAILED') return t('login.mfaSendFailed');
    if (status === 401) return t('login.invalidCredentials');
    if (status === 403) return t('login.inactiveUser');
    if (status === 429) return t('login.tooManyAttempts');
    return t('login.genericError');
  };

  const onSubmit = async ({ email, password }) => {
    setError('');
    try {
      const data = await login(email, password);
      if (data.mfaRequired) { setChallenge(data); return; }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
    }
  };

  if (challenge) {
    return (
      <AuthShell brandKey={brand.key} t={t}>
        <MfaStep
          challenge={challenge}
          t={t}
          onVerified={() => navigate('/dashboard', { replace: true })}
          onBack={() => setChallenge(null)}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell brandKey={brand.key} t={t}>
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
              {/* "¿Olvidaste tu contraseña?" (2026-11-23): misma marca que este login. */}
              <div className="text-right">
                <Link
                  to={brand.key === 'satustec' ? '/forgot-password?brand=satustec' : '/forgot-password'}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  {t('login.forgotPassword')}
                </Link>
              </div>
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
    </AuthShell>
  );
};

export default LoginPage;
