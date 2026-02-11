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

// 401 interceptor — redirect to login on auth failure
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('adminToken');
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const loginWithToken = async (token: string) => {
  const response = await publicApi.post('/api/auth/login', { token });
  return response.data;
};

const externalHeaders = {
  'X-Product-ID': 'chatgpt',
  'Content-Type': 'text/plain;charset=UTF-8'
};

export const verifyToken = async () => {
  const response = await adminApi.get('/auth/verify');
  return response.data;
};

export const checkKey = async (code: string) => {
  const response = await publicApi.post('/api/cdks/public/check', JSON.stringify({ code }), {
    headers: externalHeaders
  });
  return response.data;
};

export const checkUser = async (user: string, cdk: string) => {
  const response = await publicApi.post('/api/external/public/check-user', JSON.stringify({ user, cdk }), {
    headers: externalHeaders
  });
  return response.data;
};

export const activateKey = async (cdk: string, user: string) => {
  const response = await publicApi.post('/api/stocks/public/outstock', JSON.stringify({ cdk, user }), {
    headers: externalHeaders
  });
  return response.data;
};

export const checkStatus = async (taskId: string) => {
  const response = await publicApi.get(`/api/stocks/public/outstock/${taskId}`, {
    headers: externalHeaders
  });
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

export const updateSubscription = async (id: number, data: { email?: string, type?: string, endDate?: string, status?: string }) => {
  const response = await adminApi.put(`/subscriptions/${id}`, data);
  return response.data;
};

export const deleteSubscription = async (id: number) => {
  const response = await adminApi.delete(`/subscriptions/${id}`);
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

export const getSubscriptions = async (page = 1, limit = 20, search = '', filters = {}) => {
  const response = await adminApi.get('/subscriptions', {
      params: { page, limit, search, ...filters }
  });
  return response.data;
};

export const getDailyStats = async () => {
    const response = await adminApi.get('/stats/daily');
    return response.data;
};

// Backups API
export const getBackups = async () => {
    const response = await adminApi.get('/backups');
    return response.data;
};

export const createBackup = async () => {
    const response = await adminApi.post('/backups');
    return response.data;
};

export const deleteBackup = async (filename: string) => {
    const response = await adminApi.delete(`/backups/${filename}`);
    return response.data;
};

export const downloadBackupUrl = (filename: string) => {
    return `/api/backups/${filename}`;
};

export const getInventoryStats = async () => {
    const response = await adminApi.get('/inventory/stats');
    return response.data;
};

// Notifications API
export const getNotifications = async () => {
    const response = await adminApi.get('/notifications');
    return response.data;
};

// Health API
export const getHealth = async () => {
    const response = await adminApi.get('/health');
    return response.data;
};

// Rate Limit Stats API
export const getRateLimitStats = async () => {
    const response = await adminApi.get('/rate-limit/stats');
    return response.data;
};

// SLA API
export const getSLAStats = async () => {
    const response = await adminApi.get('/sla');
    return response.data;
};

// Calendar API
export const getCalendar = async () => {
    const response = await adminApi.get('/calendar');
    return response.data;
};

// Today Widget API
export const getTodayStats = async () => {
    const response = await adminApi.get('/today');
    return response.data;
};

// Dashboard API
export const getDashboard = async () => {
    const response = await adminApi.get('/dashboard');
    return response.data;
};

// Global Search API (Cmd+K)
export const globalSearch = async (query: string) => {
    const response = await adminApi.get('/search', { params: { q: query } });
    return response.data;
};