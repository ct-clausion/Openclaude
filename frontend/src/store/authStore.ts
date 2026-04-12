import { create } from 'zustand';
import type { User } from '../types';
import { api } from '../api/client';
import type { LoginResponse } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string, role: User['role'], inviteCode?: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') ?? 'null'),
  token: localStorage.getItem('token'),
  get isAuthenticated() {
    return this.token !== null;
  },

  login: async (email, password) => {
    const data = await api.post<LoginResponse>('/api/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    set({ user: data.user, token: data.token, isAuthenticated: true });
    return data.user;
  },

  register: async (email, password, name, role, inviteCode?) => {
    const body: Record<string, string> = { email, password, name, role };
    if (inviteCode) body.inviteCode = inviteCode;
    const data = await api.post<LoginResponse>('/api/auth/register', body);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    set({ user: data.user, token: data.token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
