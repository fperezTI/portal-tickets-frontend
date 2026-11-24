import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../api/auth';
import AuthShell, { useAuthT } from '../components/AuthShell';
import PasswordField from '../components/PasswordField';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight } from 'lucide-react';
import { getLoginPath } from '@/lib/brand';
import { newPasswordSchema } from '@/lib/passwordRules';

// Cambio de contraseña OBLIGATORIO (2026-11-23): lo muestra ProtectedRoute en
// lugar del portal mientras `user.mustChangePassword` sea true (contraseña
// temporal del correo de acceso, o capturada por el admin para un cliente).
// El backend también lo exige: con la marca activa responde 403 a todo salvo
// /auth/me y /auth/change-password. Marca e idioma = los del usuario. Al
// cambiarla, el backend devuelve una sesión nueva y entra al portal.
const ForcePasswordChangePage = () => {
  const { user, applySession, logout } = useAuth();
  const navigate = useNavigate();
  const t = useAuthT(user.company, user.language);
  const [error, setError] = useState('');

  const schema = useMemo(() => newPasswordSchema(t, {
    currentPassword: z.string().min(1, t('changePassword.currentPasswordRequired')),
  }), [t]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setError('');
    try {
      applySession(await changePassword(currentPassword, newPassword));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const code = err.response?.data?.code;
      setError(code === 'SAME_PASSWORD' ? t('changePassword.samePassword')
        : err.response?.status === 400 ? (err.response.data.error || t('passwordFlow.genericError'))
        : t('passwordFlow.genericError'));
    }
  };

  const signOut = async () => {
    await logout();
    navigate(getLoginPath(), { replace: true });
  };

  return (
    <AuthShell brandKey={user.company} t={t}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('passwordFlow.forceTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('passwordFlow.forceSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <PasswordField id="currentPassword" label={t('passwordFlow.tempPassword')} autoComplete="current-password"
          showLabel={t('login.showPassword')} hideLabel={t('login.hidePassword')}
          error={errors.currentPassword?.message} {...register('currentPassword')} />
        <PasswordField id="newPassword" label={t('changePassword.newPassword')}
          showLabel={t('login.showPassword')} hideLabel={t('login.hidePassword')}
          error={errors.newPassword?.message} {...register('newPassword')} />
        <PasswordField id="confirmPassword" label={t('changePassword.confirmPassword')}
          showLabel={t('login.showPassword')} hideLabel={t('login.hidePassword')}
          error={errors.confirmPassword?.message} {...register('confirmPassword')} />

        <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={isSubmitting}>
          {isSubmitting ? t('passwordFlow.saving') : t('passwordFlow.continue')}
          {!isSubmitting && <ArrowRight className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
          {t('passwordFlow.signOut')}
        </Button>
      </form>
    </AuthShell>
  );
};

export default ForcePasswordChangePage;
