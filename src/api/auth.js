import client from './client';

// → sesión { accessToken, user } o, con verificación en dos pasos pendiente
// (2026-11-24), { mfaRequired, mfaToken, email, codeMinutes, resendSeconds }.
export const login = (email, password) =>
  client.post('/auth/login', { email, password }).then((r) => r.data);

// Verificación en dos pasos por correo (2026-11-24). verify → { accessToken, user }.
export const verifyMfa = (mfaToken, code, remember) =>
  client.post('/auth/mfa/verify', { mfaToken, code, remember }).then((r) => r.data);

export const resendMfa = (mfaToken) =>
  client.post('/auth/mfa/resend', { mfaToken }).then((r) => r.data);

export const getMe = () =>
  client.get('/auth/me').then((r) => r.data.user);

// Devuelve { accessToken, user } — una sesión nueva para este navegador
// (2026-11-23); las demás sesiones del usuario quedan cerradas.
export const changePassword = (currentPassword, newPassword) =>
  client.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data);

export const logout = () =>
  client.post('/auth/logout').then((r) => r.data);

// "¿Olvidaste tu contraseña?" (2026-11-23, públicos). forgot responde siempre
// lo mismo, exista o no el correo.
export const forgotPassword = (email) =>
  client.post('/auth/forgot-password', { email }).then((r) => r.data);

// → { valid, company?, language? } (marca e idioma del usuario del token)
export const validateResetToken = (token) =>
  client.get('/auth/reset-password/validate', { params: { token } }).then((r) => r.data);

export const resetPassword = (token, newPassword) =>
  client.post('/auth/reset-password', { token, newPassword }).then((r) => r.data);
