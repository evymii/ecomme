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
      setUser: (user) => {
        set({ user });
        // Set or clear admin cookie so middleware allows/blocks /admin routes
        if (typeof document !== 'undefined') {
          if (user?.role === 'admin') {
            document.cookie = `admin_verified=true; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
          } else {
            document.cookie = 'admin_verified=; path=/; max-age=0; SameSite=Lax';
          }
        }
      },
      setToken: (token) => {
        set({ token });
        if (token) {
          localStorage.setItem('token', token);
          try {
            const currentState = get();
            if (currentState.user) {
              localStorage.setItem('auth-storage', JSON.stringify({
                state: {
                  user: currentState.user,
                  token: token
                },
                version: 0
              }));
            }
          } catch (e) {
            console.error('Error persisting auth state:', e);
          }
        } else {
          localStorage.removeItem('token');
        }
      },
      logout: () => {
        set({ user: null, token: null });
        localStorage.removeItem('token');
        localStorage.removeItem('auth-storage');
        // Clear admin cookie so middleware blocks /admin routes
        if (typeof document !== 'undefined') {
          document.cookie = 'admin_verified=; path=/; max-age=0; SameSite=Lax';
        }
      },
      isAdmin: () => {
        return get().user?.role === 'admin';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
