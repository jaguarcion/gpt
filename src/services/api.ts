import axios from 'axios';

// Instance for External API (proxied via /api)
const publicApi = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Instance for Internal Admin API (proxied via /api/keys, etc)
const adminApi = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  baseURL: '/api' // Explicitly set base URL to hit the proxy
});

export const setAuthToken = (token: string) => {
  adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const checkKey = async (code: string) => {
  const response = await publicApi.post('/api/cdks/public/check', { code }, {
    headers: { 'x-product-id': 'chatgpt' }
  });
  return response.data;
};

export const activateKey = async (cdk: string, user: string | object) => {
  const response = await publicApi.post('/api/stocks/public/outstock', { cdk, user });
  return response.data;
};

export const checkStatus = async (taskId: string) => {
  const response = await publicApi.get(`/api/stocks/public/outstock/${taskId}`);
  return response.data;
};

// Admin APIs
export const getStats = async () => {
  const response = await adminApi.get('/keys/stats'); // becomes /api/keys/stats
  return response.data;
};

export const getKeys = async (page = 1, limit = 20, status = 'all') => {
  const response = await adminApi.get('/keys', {
    params: { page, limit, status }
  });
  return response.data;
};

export const manualActivateSubscription = async (id: number) => {
  const response = await adminApi.post(`/subscriptions/${id}/activate`);
  return response.data;
};

export const deleteKey = async (id: number) => {
  const response = await adminApi.delete(`/keys/${id}`);
  return response.data;
};

export const addKey = async (codes: string | string[]) => {
  if (Array.isArray(codes)) {
    const response = await adminApi.post('/keys', { codes });
    return response.data;
  }
  const response = await adminApi.post('/keys', { code: codes });
  return response.data;
};

export const getSubscriptions = async () => {
  const response = await adminApi.get('/subscriptions');
  return response.data;
};
