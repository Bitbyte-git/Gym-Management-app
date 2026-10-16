import api from './api';

export const dashboardService = {
  getAdminStats: () => api.get('/dashboard/admin'),
  getTrainerStats: () => api.get('/dashboard/trainer'),
  getMemberStats: () => api.get('/dashboard/member'),
  getReceptionStats: () => api.get('/dashboard/reception'),
};
