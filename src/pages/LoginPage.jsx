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
import { ArrowRight, Layers } from 'lucide-react';

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

/* Decorative asterisk / star inspired by Grupo Staff logo */
const GsAsterisk = ({ className = '' }) => (
  <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden>
    {/* Top - cyan */}
    <path d="M40 4 L46 30 L34 30 Z" fill="oklch(0.68 0.11 208)" opacity="0.9" />
    {/* Top-right - orange */}
    <path d="M72 16 L52 36 L44 24 Z" fill="oklch(0.72 0.18 48)" opacity="0.9" />
    {/* Right - orange-red */}
    <path d="M76 40 L50 46 L50 34 Z" fill="oklch(0.65 0.22 32)" opacity="0.85" />
    {/* Bottom-right - green */}
    <path d="M64 70 L44 50 L56 44 Z" fill="oklch(0.62 0.17 145)" opacity="0.9" />
    {/* Bottom-left - green */}
    <path d="M16 70 L36 50 L36 62 Z" fill="oklch(0.55 0.15 145)" opacity="0.85" />
    {/* Left - red */}
    <path d="M4 40 L30 34 L30 46 Z" fill="oklch(0.60 0.22 20)" opacity="0.9" />
    {/* Top-left - teal */}
    <path d="M8 16 L28 36 L20 44 Z" fill="oklch(0.68 0.11 208)" opacity="0.70" />
  </svg>
);

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

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
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'var(--gs-cyan)' }}
        />
        <div
          className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-[0.07]"
          style={{ background: 'var(--gs-cyan)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <img
            src="/LOGO%20GS%20Azul_300.png"
            alt="Grupo Staff"
            className="h-12 w-auto object-contain object-left"
            style={{ maxWidth: '220px' }}
          />
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <GsAsterisk className="w-20 h-20 mb-4" />
          <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Portal de<br />
            <span style={{ color: 'var(--gs-cyan)' }}>Soporte</span>
          </h1>
          <p style={{ color: 'oklch(1 0 0 / 0.55)' }} className="text-base leading-relaxed max-w-xs">
            Crea, consulta y da seguimiento a tus solicitudes de soporte en un solo lugar.
          </p>

          {/* Features */}
          <div className="space-y-3 pt-2">
            {['Integrado con Dynamics 365', 'Seguimiento en tiempo real', 'Gestión centralizada'].map((f) => (
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
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-8">

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
              <Input
                id="email"
                type="email"
                placeholder="usuario@empresa.com"
                autoComplete="email"
                className="h-10"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-10"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-semibold gap-2"
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
