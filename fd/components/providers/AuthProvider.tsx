'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setToken = useAuthStore((state) => state.setToken);

  useEffect(() => {
    // Initialize auth on app load
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await api.get('/users/profile');
          if (response.data.success && response.data.user) {
            setToken(token);
            setUser({
              ...response.data.user,
              id: response.data.user.id || response.data.user._id
            });
          }
        } catch (error) {
          // Invalid token, clear it
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
    };
    initializeAuth();
  }, [setUser, setToken]);

  return <>{children}</>;
}
