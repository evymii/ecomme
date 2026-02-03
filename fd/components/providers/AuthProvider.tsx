'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setToken = useAuthStore((state) => state.setToken);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Initialize auth on app load - only once
    if (hasInitialized.current) return;
    
    const initializeAuth = async () => {
      hasInitialized.current = true;
      
      // Check if already initialized from persisted state
      const existingUser = useAuthStore.getState().user;
      const existingToken = useAuthStore.getState().token;
      
      // If user is already in store, don't re-fetch
      if (existingUser && existingToken) {
        return;
      }
      
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return <>{children}</>;
}
