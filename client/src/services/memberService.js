import api from './api';

export const memberService = {
  getAll: (params) => api.get('/members', { params }),
  getById: (id) => api.get(`/members/${id}`),
  create: (data) => api.post('/members', data),
  update: (id, data) => api.put(`/members/${id}`, data),
  delete: (id) => api.delete(`/members/${id}`),
  getProfile: () => api.get('/members/profile'),
  updateProfile: (data) => api.put('/members/profile', data),
  uploadAvatar: (formData) => api.post('/members/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};
