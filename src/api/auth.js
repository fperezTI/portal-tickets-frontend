import client from './client';

export const login = (email, password) =>
  client.post('/auth/login', { email, password }).then((r) => r.data);

export const getMe = () =>
  client.get('/auth/me').then((r) => r.data.user);

export const changePassword = (currentPassword, newPassword) =>
  client.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data);

export const logout = () =>
  client.post('/auth/logout').then((r) => r.data);
