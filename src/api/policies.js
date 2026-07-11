import client from './client';

export const listMyPolicies     = (params) => client.get('/policies/mine', { params }).then((r) => r.data);
export const getPolicyDetail    = (id)     => client.get(`/policies/${id}`).then((r) => r.data);
export const listPolicyCustomers = ()      => client.get('/policies/customers').then((r) => r.data);
export const searchPolicies     = (q)      => client.get('/policies/search', { params: { q } }).then((r) => r.data);
export const updatePolicyStatus = (id, active) => client.patch(`/policies/${id}/status`, { active }).then((r) => r.data);

export const getAllocationSuggestions = (policyId) => client.get(`/policies/${policyId}/allocation-suggestions`).then((r) => r.data);
export const listAllocations          = (policyId) => client.get(`/policies/${policyId}/allocations`).then((r) => r.data);
export const createAllocations        = (policyId, allocations) => client.post(`/policies/${policyId}/allocations`, { allocations }).then((r) => r.data);
export const deactivateAllocation     = (policyId, allocationId) => client.delete(`/policies/${policyId}/allocations/${allocationId}`).then((r) => r.data);
export const deactivateAllocationsForDetail = (policyId, detailId) => client.delete(`/policies/${policyId}/support-details/${detailId}/allocations`).then((r) => r.data);
