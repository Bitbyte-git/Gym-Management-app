import api from './api';

const withRegistrationToken = () => {
  const token = localStorage.getItem('registrationToken');
  return token ? { headers: { 'X-Registration-Token': token } } : {};
};

export const registrationService = {
  saveBasicDetails: async (data) => {
    const response = await api.post('/registration/basic-details', data, withRegistrationToken());
    if (response.data.data?.registrationToken) {
      localStorage.setItem('registrationToken', response.data.data.registrationToken);
    }
    return response;
  },
  saveHealthDetails: (data) => api.post('/registration/health-details', data, withRegistrationToken()),
  getPlans: () => api.get('/registration/plans'),
  getSlots: (planId) => api.get('/registration/slots', { params: { planId } }),
  getTrainers: (slotId) => api.get('/registration/trainers', { params: { slotId } }),
  checkout: () => api.post('/registration/checkout', {}, withRegistrationToken()),
  cancelCheckout: () => api.post('/registration/cancel-checkout', {}, withRegistrationToken()),
  resume: async (data) => {
    const response = await api.post('/registration/resume', data);
    localStorage.setItem('registrationToken', response.data.data.registrationToken);
    return response;
  },
  saveSelection: (data) => api.post('/registration/selection', data, withRegistrationToken()),
  getSummary: () => api.get('/registration/summary', withRegistrationToken()),
  complete: (data) => api.post('/registration/complete', data, withRegistrationToken()),
};
