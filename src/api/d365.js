import client from './client';

export const searchContacts = (search) =>
  client.get('/d365/contacts', { params: { search } }).then((r) => r.data);

export const searchAccounts = (search) =>
  client.get('/d365/accounts', { params: { search } }).then((r) => r.data);

export const resolveContact = (id) =>
  client.get(`/d365/contacts/${id}`).then((r) => r.data);

export const resolveAccount = (id) =>
  client.get(`/d365/accounts/${id}`).then((r) => r.data);

export const listServiceCategories = () =>
  client.get('/d365/service-categories').then((r) => r.data);

export const listSystems = () =>
  client.get('/d365/systems').then((r) => r.data);

export const listAreas = () =>
  client.get('/d365/areas').then((r) => r.data);

export const searchSystemUsers = (search) =>
  client.get('/d365/users', { params: { search } }).then((r) => r.data);
