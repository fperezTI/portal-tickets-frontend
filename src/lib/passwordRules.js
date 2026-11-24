import { z } from 'zod';

// Reglas de contraseña nueva — las mismas que valida el backend
// (routes/index.js: mínimo 8, una mayúscula, un número). Mensajes por i18n
// (`changePassword.*`) en el idioma de la pantalla que la usa.
export const newPasswordRule = (t) => z.string()
  .min(8, t('changePassword.minLength'))
  .regex(/[A-Z]/, t('changePassword.needsUppercase'))
  .regex(/[0-9]/, t('changePassword.needsNumber'));

// { newPassword, confirmPassword } + lo que se pase en `extra`.
export const newPasswordSchema = (t, extra = {}) => z.object({
  ...extra,
  newPassword: newPasswordRule(t),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: t('changePassword.mismatch'),
  path: ['confirmPassword'],
});
