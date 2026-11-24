import client from './client';

export const listUsers = (params) =>
  client.get('/users', { params }).then((r) => r.data);

export const createUser = (data) =>
  client.post('/users', data).then((r) => r.data);

export const updateUser = (id, data) =>
  client.put(`/users/${id}`, data).then((r) => r.data);

// Reenvía el correo de acceso a un cliente: genera una contraseña temporal
// NUEVA (reemplaza la actual) y exige cambiarla al entrar (2026-11-23).
export const resendAccess = (id) =>
  client.post(`/users/${id}/resend-access`).then((r) => r.data);

export const deleteUser = (id) =>
  client.delete(`/users/${id}`).then((r) => r.data);
