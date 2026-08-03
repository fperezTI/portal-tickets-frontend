import client from './client';

export const listCases     = (params) => client.get('/cases', { params }).then((r) => r.data);
export const listMyCases   = (params) => client.get('/cases/mine', { params }).then((r) => r.data);
export const createCase    = (data)   => client.post('/cases', data).then((r) => r.data);
export const getCaseDetail = (id)     => client.get(`/cases/${id}`).then((r) => r.data);
export const cancelCase    = (id)     => client.delete(`/cases/${id}`).then((r) => r.data);
export const updateCasePolicy = (id, policyId) => client.patch(`/cases/${id}/policy`, { policyId }).then((r) => r.data);

export const addCaseComment = (caseId, { notetext, file }) => {
  const formData = new FormData();
  if (notetext) formData.append('notetext', notetext);
  if (file) formData.append('file', file);
  return client.post(`/cases/${caseId}/comments`, formData).then((r) => r.data);
};

export const downloadCaseComment = (caseId, commentId) =>
  client.get(`/cases/${caseId}/comments/${commentId}/download`, { responseType: 'blob' })
    .then((r) => {
      const disposition = r.headers['content-disposition'] || '';
      const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(disposition);
      const filename = decodeURIComponent(match?.[1] || match?.[2] || 'archivo');
      return { blob: r.data, filename };
    });
export const getStats      = ()       => client.get('/stats').then((r) => r.data);
export const getDashboard  = ()       => client.get('/dashboard').then((r) => r.data);
export const getStages     = ()       => client.get('/stages').then((r) => r.data);
export const getGeneralConsumption = (params) => client.get('/general-consumption', { params }).then((r) => r.data);
export const getGeneralConsumptionByCustomer = (month) => client.get('/general-consumption/by-customer', { params: { month } }).then((r) => r.data);
