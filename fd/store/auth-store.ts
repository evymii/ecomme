import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  phoneNumber: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  address?: {
    city: string;
    district: string;
    khoroo: string;
    deliveryAddress: string;
    additionalInfo?: string;
  };
}

interface AuthStore {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => {
        set({ token });
        if (token) {
          localStorage.setItem('token', token);
        } else {
          localStorage.removeItem('token');
        }
      },
      logout: () => {
        set({ user: null, token: null });
        localStorage.removeItem('token');
      },
      isAdmin: () => {
        return get().user?.role === 'admin';
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
