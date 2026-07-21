import client from './client';

export const listCases     = (params) => client.get('/cases', { params }).then((r) => r.data);
export const listMyCases   = (params) => client.get('/cases/mine', { params }).then((r) => r.data);
export const createCase    = (data)   => client.post('/cases', data).then((r) => r.data);
export const getCaseDetail = (id)     => client.get(`/cases/${id}`).then((r) => r.data);
export const cancelCase    = (id)     => client.delete(`/cases/${id}`).then((r) => r.data);
export const updateCasePolicy = (id, policyId) => client.patch(`/cases/${id}/policy`, { policyId }).then((r) => r.data);
export const getStats      = ()       => client.get('/stats').then((r) => r.data);
export const getDashboard  = ()       => client.get('/dashboard').then((r) => r.data);
export const getStages     = ()       => client.get('/stages').then((r) => r.data);
export const getGeneralConsumption = (params) => client.get('/general-consumption', { params }).then((r) => r.data);
