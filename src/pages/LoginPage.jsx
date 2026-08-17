import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Layers, Mail, Lock, Eye, EyeOff } from 'lucide-react';

// El formulario de login se muestra siempre antes de conocer al usuario (y
// por lo tanto su idioma), así que sus mensajes de validación no pasan por
// i18n — se ven en español, igual que el resto de esta pantalla.
const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email, password }) => {
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales incorrectas');
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo — branding Grupo Staff ── */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, var(--gs-navy) 0%, oklch(0.19 0.07 258) 100%)',
        }}
      >
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/isotipo.png" alt="" className="w-9 h-9 shrink-0 object-contain" />
          <div className="leading-tight">
            <p className="text-white font-bold text-base tracking-tight">GRUPO STAFF</p>
            <p className="text-[10px] tracking-wider" style={{ color: 'oklch(1 0 0 / 0.5)' }}>
              BUSINESS PROCESS &amp; IT CONSULTING
            </p>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold font-display text-white leading-tight tracking-tight">
            Portal de<br />
            <span style={{ color: 'var(--gs-cyan)' }}>Soporte</span>
          </h1>
          <p style={{ color: 'oklch(1 0 0 / 0.55)' }} className="text-base leading-relaxed max-w-xs">
            Crea, consulta y da seguimiento a tus solicitudes de soporte en un solo lugar.
          </p>

          {/* Features */}
          <div className="space-y-3 pt-2">
            {['Integrado con Microsoft Dynamics 365', 'Seguimiento en tiempo real', 'Gestión centralizada de tickets'].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'var(--gs-cyan)' }}
                />
                <span className="text-sm" style={{ color: 'oklch(1 0 0 / 0.60)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] relative z-10" style={{ color: 'oklch(1 0 0 / 0.25)' }}>
          © {new Date().getFullYear()} Grupo Staff · Todos los derechos reservados
        </p>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: 'oklch(0.97 0.004 258)' }}>
        <div className="w-full max-w-sm bg-card border rounded-2xl shadow-xl p-8 space-y-8">

          {/* Mobile logo */}
          <div className="lg:hidden">
            <img
              src="/LOGO%20GS%20Azul_300.png"
              alt="Grupo Staff"
              className="h-10 w-auto object-contain"
              style={{ maxWidth: '200px' }}
            />
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Bienvenido</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ingresa tus credenciales para acceder al portal
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@empresa.com"
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
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  className="h-11 pl-10 pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
              {isSubmitting ? 'Verificando...' : 'Ingresar'}
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          {/* Powered by */}
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Layers className="h-3 w-3" /> Powered by Dynamics 365
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
