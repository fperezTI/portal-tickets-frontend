import client from './client';

export const getConsumption = (params) => client.get('/consumption', { params }).then((r) => r.data);
export const listConsumptionCustomers = () => client.get('/consumption/customers').then((r) => r.data);
