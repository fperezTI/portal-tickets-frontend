import client from './client';

export const searchContacts = (search) =>
  client.get('/d365/contacts', { params: { search } }).then((r) => r.data);

export const searchAccounts = (search) =>
  client.get('/d365/accounts', { params: { search } }).then((r) => r.data);

export const resolveContact = (id) =>
  client.get(`/d365/contacts/${id}`).then((r) => r.data);

export const resolveAccount = (id) =>
  client.get(`/d365/accounts/${id}`).then((r) => r.data);
