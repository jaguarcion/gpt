import axios from 'axios';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

export const checkKey = async (code: string) => {
  const response = await api.post('/api/cdks/public/check', { code }, {
    headers: { 'x-product-id': 'chatgpt' }
  });
  return response.data;
};

export const activateKey = async (cdk: string, user: string | object) => {
  const response = await api.post('/api/stocks/public/outstock', { cdk, user });
  return response.data;
};

export const checkStatus = async (taskId: string) => {
  const response = await api.get(`/api/stocks/public/outstock/${taskId}`);
  return response.data;
};
