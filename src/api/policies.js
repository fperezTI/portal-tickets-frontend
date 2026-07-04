import client from './client';

export const listMyPolicies     = (params) => client.get('/policies/mine', { params }).then((r) => r.data);
export const getPolicyDetail    = (id)     => client.get(`/policies/${id}`).then((r) => r.data);
export const listPolicyCustomers = ()      => client.get('/policies/customers').then((r) => r.data);
