import api from './api';

export const attendanceService = {
  getAll: (params) => api.get('/attendance', { params }),
  getById: (id) => api.get(`/attendance/${id}`),
  getByMember: (memberId, params) => api.get(`/attendance/member/${memberId}`, { params }),
  getToday: () => api.get('/attendance/today'),
  checkIn: (data) => api.post('/attendance/checkin', data),
  checkOut: (data) => api.post('/attendance/checkout', data),
  manualCheckIn: (data) => api.post('/attendance/manual-checkin', data),
  manualCheckOut: (data) => api.post('/attendance/manual-checkout', data),
  correct: (id, data) => api.put(`/attendance/${id}/correct`, data),
  getStats: (params) => api.get('/attendance/stats', { params }),
};
