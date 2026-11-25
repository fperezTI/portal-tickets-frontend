import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resendMfa } from '../api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Segundo paso del inicio de sesión: código de verificación enviado al correo
// (2026-11-24, solo usuarios con la verificación activa). Va dentro del
// AuthShell de LoginPage, con su misma marca y su mismo t() (Satustec en inglés).
// `challenge` = respuesta del login { mfaToken, email, codeMinutes, resendSeconds }.
const MfaStep = ({ challenge, t, onVerified, onBack }) => {
  const { verifyMfa } = useAuth();
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(challenge.resendSeconds ?? 60);
  // Al vencer el paso intermedio (30 min) ya no se puede reintentar: solo volver.
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const messageFor = (err) => {
    const data = err.response?.data || {};
    switch (data.code) {
      case 'MFA_INVALID_CODE':      return t('login.mfaInvalidCode', { count: data.attemptsLeft });
      case 'MFA_CODE_EXPIRED':      return t('login.mfaCodeExpired');
      case 'MFA_TOO_MANY_ATTEMPTS': return t('login.mfaTooManyAttempts');
      case 'MFA_SESSION_EXPIRED':   setExpired(true); return t('login.mfaSessionExpired');
      case 'MFA_SEND_FAILED':       return t('login.mfaSendFailed');
      case 'MFA_RESEND_WAIT':       setResendIn(data.retryAfter || 30); return '';
      default:
        if (err.response?.status === 429) return t('login.tooManyAttempts');
        if (err.response?.status === 422) return t('login.mfaCodeFormat');
        return t('login.genericError');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!/^\d{6}$/.test(code)) { setError(t('login.mfaCodeFormat')); return; }
    setBusy(true);
    try {
      await verifyMfa(challenge.mfaToken, code, remember);
      onVerified();
    } catch (err) {
      setError(messageFor(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setError(''); setInfo('');
    try {
      const r = await resendMfa(challenge.mfaToken);
      setResendIn(r.resendSeconds ?? 60);
      setInfo(t('login.mfaResent'));
    } catch (err) {
      const msg = messageFor(err);
      if (msg) setError(msg);
    }
  };

  return (
    <>
      <div>
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{t('login.mfaTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('login.mfaSubtitle', { email: challenge.email })}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {info && (
          <Alert>
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="mfa-code">{t('login.mfaCode')}</Label>
          <Input
            id="mfa-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            disabled={expired}
            className="h-12 text-center text-2xl font-semibold tracking-[0.5em] font-mono"
          />
        </div>

        <div className="flex items-start gap-3">
          <Switch id="mfa-remember" checked={remember} onCheckedChange={setRemember} disabled={expired} className="mt-0.5" />
          <div className="space-y-0.5">
            <Label htmlFor="mfa-remember" className="cursor-pointer">{t('login.mfaRemember')}</Label>
            <p className="text-xs text-muted-foreground">{t('login.mfaRememberHint')}</p>
          </div>
        </div>

        <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={busy || expired || code.length !== 6}>
          {busy ? t('login.mfaVerifying') : t('login.mfaVerify')}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </Button>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> {t('login.mfaBack')}
          </button>
          <button
            type="button"
            onClick={onResend}
            disabled={resendIn > 0 || expired}
            className="font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline disabled:no-underline disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {resendIn > 0 ? t('login.mfaResendIn', { seconds: resendIn }) : t('login.mfaResend')}
          </button>
        </div>
      </form>
    </>
  );
};

export default MfaStep;
