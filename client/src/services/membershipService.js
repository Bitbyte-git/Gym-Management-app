import api from './api';

export const membershipService = {
  getAll: (params) => api.get('/memberships', { params }),
  getById: (id) => api.get(`/memberships/${id}`),
  getByMember: (memberId) => api.get(`/memberships/member/${memberId}`),
  create: (data) => api.post('/memberships', data),
  renew: (id, data) => api.post(`/memberships/${id}/renew`, data),
  change: (id, data) => api.post(`/memberships/${id}/change`, data),
  cancel: (id) => api.post(`/memberships/${id}/cancel`),
  freeze: (id, data) => api.post(`/memberships/${id}/freeze`, data),
  unfreeze: (id) => api.post(`/memberships/${id}/unfreeze`),
};
