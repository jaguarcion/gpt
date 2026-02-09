import { create } from 'zustand';
import { setAuthToken } from '../services/api';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: (token: string) => {
    localStorage.setItem('adminToken', token);
    setAuthToken(token);
    set({ token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('adminToken');
    setAuthToken('');
    set({ token: null, isAuthenticated: false, isLoading: false });
  },

  initialize: () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setAuthToken(token);
      set({ token, isAuthenticated: true, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },
}));
