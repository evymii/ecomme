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
          // Ensure token persists
          try {
            const currentState = get();
            if (currentState.user) {
              // Re-persist the state with token
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
        // Clear persisted state
        localStorage.removeItem('auth-storage');
      },
      isAdmin: () => {
        return get().user?.role === 'admin';
      },
    }),
    {
      name: 'auth-storage',
      // Persist for 30 days (1 month)
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
