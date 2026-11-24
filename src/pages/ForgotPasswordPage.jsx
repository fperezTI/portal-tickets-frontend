import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { forgotPassword } from '../api/auth';
import AuthShell, { LOGIN_THEMES, useAuthT } from '../components/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Mail, MailCheck } from 'lucide-react';
import { getBrand, setTab } from '@/lib/brand';

// "¿Olvidaste tu contraseña?" (2026-11-23, todos los roles). Pública. Marca =
// la del login desde el que se llegó (?brand=satustec desde /loginst; en ese
// caso, en inglés como ese login). El backend responde SIEMPRE lo mismo,
// exista o no el correo, así que aquí también: un solo mensaje de "si está
// registrado, te llegará un enlace".
const ForgotPasswordPage = () => {
  const [params] = useSearchParams();
  const brand = getBrand(params.get('brand'));
  const theme = LOGIN_THEMES[brand.key];
  const t = useAuthT(brand.key);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTab(brand.documentTitle[theme.fixedLanguage || 'es'], brand.favicon);
  }, [brand, theme.fixedLanguage]);

  const schema = useMemo(() => z.object({ email: z.string().email(t('login.invalidEmail')) }), [t]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }) => {
    setError('');
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.status === 429 ? t('login.tooManyAttempts') : t('passwordFlow.genericError'));
    }
  };

  return (
    <AuthShell brandKey={brand.key} t={t}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('passwordFlow.forgotTitle')}</h2>
        {!sent && <p className="text-sm text-muted-foreground mt-1">{t('passwordFlow.forgotSubtitle')}</p>}
      </div>

      {sent ? (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-lg border bg-muted/30 p-4">
            <MailCheck className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm">{t('passwordFlow.forgotSent')}</p>
          </div>
          <Button asChild variant="outline" className="w-full h-11">
            <Link to={brand.loginPath}>{t('passwordFlow.backToLogin')}</Link>
          </Button>
        </div>
      ) : (
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
              <Input id="email" type="email" placeholder={t('login.emailPlaceholder')} autoComplete="email" className="h-11 pl-10" {...register('email')} />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={isSubmitting}>
            {isSubmitting ? t('passwordFlow.sending') : t('passwordFlow.sendLink')}
            {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </Button>
          <div className="text-center">
            <Link to={brand.loginPath} className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              {t('passwordFlow.backToLogin')}
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPasswordPage;
