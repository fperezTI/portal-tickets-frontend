import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { validateResetToken, resetPassword } from '../api/auth';
import AuthShell, { useAuthT } from '../components/AuthShell';
import PasswordField from '../components/PasswordField';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, CircleCheck, CircleAlert } from 'lucide-react';
import { getBrand, setTab } from '@/lib/brand';
import { newPasswordSchema } from '@/lib/passwordRules';

// "Crear nueva contraseña" (2026-11-23): destino del link del correo de
// "¿Olvidaste tu contraseña?" (/reset-password?token=…). Pública. Primero
// valida el token con el backend, que devuelve la empresa y el idioma del
// usuario para pintar su marca. El token dura 60 min y es de un solo uso; al
// guardar se cierran todas las sesiones del usuario y se le manda al login de
// su empresa (no inicia sesión solo).
const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState({ status: 'checking', company: null, language: null }); // checking | valid | invalid | done
  const brand = getBrand(state.company);
  const t = useAuthT(brand.key, state.language);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const check = /^[A-Za-z0-9_-]{43}$/.test(token)
      ? validateResetToken(token).catch(() => ({ valid: false }))
      : Promise.resolve({ valid: false });
    check.then((r) => {
      if (alive) setState(r.valid ? { status: 'valid', company: r.company, language: r.language } : { status: 'invalid', company: null, language: null });
    });
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    setTab(brand.documentTitle[state.language || (brand.key === 'satustec' ? 'en' : 'es')] || brand.documentTitle.es, brand.favicon);
  }, [brand, state.language]);

  const schema = useMemo(() => newPasswordSchema(t), [t]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async ({ newPassword }) => {
    setError('');
    try {
      await resetPassword(token, newPassword);
      setState((s) => ({ ...s, status: 'done' }));
    } catch (err) {
      if (err.response?.data?.code === 'INVALID_RESET_TOKEN') setState((s) => ({ ...s, status: 'invalid' }));
      else setError(err.response?.status === 429 ? t('login.tooManyAttempts') : t('passwordFlow.genericError'));
    }
  };

  const forgotLink = brand.key === 'satustec' ? '/forgot-password?brand=satustec' : '/forgot-password';

  return (
    <AuthShell brandKey={brand.key} t={t}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('passwordFlow.resetTitle')}</h2>
        {state.status === 'valid' && <p className="text-sm text-muted-foreground mt-1">{t('passwordFlow.resetSubtitle')}</p>}
      </div>

      {state.status === 'checking' && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          {t('passwordFlow.checkingLink')}
        </div>
      )}

      {state.status === 'invalid' && (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <CircleAlert className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm">{t('passwordFlow.invalidLink')}</p>
          </div>
          <Button asChild className="w-full h-11">
            <Link to={forgotLink}>{t('passwordFlow.requestNewLink')}</Link>
          </Button>
        </div>
      )}

      {state.status === 'done' && (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-lg border bg-muted/30 p-4">
            <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm">{t('passwordFlow.resetDone')}</p>
          </div>
          <Button asChild className="w-full h-11 font-semibold gap-2">
            <Link to={brand.loginPath}>{t('passwordFlow.goToLogin')} <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      )}

      {state.status === 'valid' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <PasswordField id="newPassword" label={t('changePassword.newPassword')}
            showLabel={t('login.showPassword')} hideLabel={t('login.hidePassword')}
            error={errors.newPassword?.message} {...register('newPassword')} />
          <PasswordField id="confirmPassword" label={t('changePassword.confirmPassword')}
            showLabel={t('login.showPassword')} hideLabel={t('login.hidePassword')}
            error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={isSubmitting}>
            {isSubmitting ? t('passwordFlow.saving') : t('passwordFlow.savePassword')}
            {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPasswordPage;
