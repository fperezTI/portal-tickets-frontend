import client from './client';

export const listCases     = (params) => client.get('/cases', { params }).then((r) => r.data);
export const createCase    = (data)   => client.post('/cases', data).then((r) => r.data);
export const getCaseDetail = (id)     => client.get(`/cases/${id}`).then((r) => r.data);
export const getStats      = ()       => client.get('/stats').then((r) => r.data);
export const getDashboard  = ()       => client.get('/dashboard').then((r) => r.data);
export const getStages     = ()       => client.get('/stages').then((r) => r.data);
