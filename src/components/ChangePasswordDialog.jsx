import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { toast } from 'sonner';
import { changePassword } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const ChangePasswordDialog = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { applySession } = useAuth();
  const [error, setError] = useState('');

  // Mismas reglas que valida el backend (routes/index.js) — se validan
  // también aquí para dar el error antes de golpear la API. Este diálogo lo
  // usan clientes que pueden tener el portal en inglés, así que los mensajes
  // sí pasan por i18n (a diferencia de los formularios internos de admin).
  const schema = useMemo(() => z.object({
    currentPassword: z.string().min(1, t('changePassword.currentPasswordRequired')),
    newPassword: z.string()
      .min(8, t('changePassword.minLength'))
      .regex(/[A-Z]/, t('changePassword.needsUppercase'))
      .regex(/[0-9]/, t('changePassword.needsNumber')),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('changePassword.mismatch'),
    path: ['confirmPassword'],
  }), [t]);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const handleClose = () => { reset(); setError(''); onClose(); };

  // Desde 2026-11-23 el backend devuelve una sesión NUEVA al cambiar la
  // contraseña (las demás sesiones del usuario quedan cerradas): el usuario
  // sigue dentro, ya no se le manda al login.
  const onSubmit = async (data) => {
    setError('');
    try {
      const session = await changePassword(data.currentPassword, data.newPassword);
      applySession(session);
      toast.success(t('changePassword.successToast'));
      reset();
      onClose();
    } catch (err) {
      setError(err.response?.data?.code === 'SAME_PASSWORD'
        ? t('changePassword.samePassword')
        : err.response?.data?.error || t('changePassword.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('changePassword.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">{t('changePassword.currentPassword')}</Label>
            <Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} />
            {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">{t('changePassword.newPassword')}</Label>
            <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} />
            {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t('changePassword.confirmPassword')}</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('changePassword.saving') : t('changePassword.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
