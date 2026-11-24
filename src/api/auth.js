import client from './client';

export const login = (email, password) =>
  client.post('/auth/login', { email, password }).then((r) => r.data);

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
