'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

export function useAdminAuth() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const hasCheckedRef = useRef(false); // Prevent multiple simultaneous checks
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false); // Prevent multiple redirects

  useEffect(() => {
    // Prevent multiple checks - check only once per component mount
    if (hasCheckedRef.current) return;
    
    let isMounted = true;
    hasCheckedRef.current = true; // Mark as checked - never reset

    const checkAuth = async () => {
      try {
        // First, check persisted state from Zustand
        const storeState = useAuthStore.getState();
        const currentUser = storeState.user;
        const storeToken = storeState.token;
        
        // Also check localStorage as backup
        const localStorageToken = localStorage.getItem('token');
        const token = storeToken || localStorageToken;
        
        // If we have user in store and token, and user is admin, we're good
        if (currentUser?.role === 'admin' && token) {
          // Ensure token is in both places
          if (!storeToken && localStorageToken) {
            useAuthStore.getState().setToken(localStorageToken);
          }
          if (isMounted) {
            setIsAdmin(true);
            setIsChecking(false);
          }
          return;
        }

        // If no token at all, redirect
        if (!token) {
          if (isMounted && !hasRedirectedRef.current) {
            setIsChecking(false);
            setIsAdmin(false);
            hasRedirectedRef.current = true;
            router.push('/');
          }
          return;
        }
        
        // Ensure token is in store
        if (!storeToken && token) {
          useAuthStore.getState().setToken(token);
        }

        // Use dedicated admin check endpoint (faster and lighter)
        try {
          const response = await api.get('/admin/check');
          if (response.data.success && response.data.isAdmin) {
            // Always update user in store to ensure it's fresh
            if (response.data.user) {
              useAuthStore.getState().setUser({
                id: response.data.user.id,
                role: response.data.user.role,
                phoneNumber: response.data.user.phoneNumber || '',
                email: response.data.user.email || '',
                name: response.data.user.name || ''
              });
            }
            
            if (isMounted) {
              setIsAdmin(true);
              setIsChecking(false);
            }
          } else {
            // Not admin - redirect
            if (isMounted && !hasRedirectedRef.current) {
              setIsChecking(false);
              setIsAdmin(false);
              hasRedirectedRef.current = true;
              router.push('/');
            }
          }
        } catch (error: any) {
          console.error('Admin auth check failed:', error);
          
          // If 401/403, token is invalid or expired
          if (error.response?.status === 401 || error.response?.status === 403) {
            // Clear invalid token
            useAuthStore.getState().logout();
            if (isMounted && !hasRedirectedRef.current) {
              setIsChecking(false);
              setIsAdmin(false);
              hasRedirectedRef.current = true;
              router.push('/');
            }
          } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            // Network timeout - don't clear token, just show error
            console.error('Network timeout - keeping auth state');
            if (isMounted) {
              setIsChecking(false);
              setIsAdmin(false);
              // Don't redirect on timeout - let user retry
            }
          } else {
            // Other network error - try fallback to profile endpoint
            try {
              const profileResponse = await api.get('/users/profile');
              if (profileResponse.data.success && profileResponse.data.user?.role === 'admin') {
                // Update store with full user data
                useAuthStore.getState().setUser({
                  ...profileResponse.data.user,
                  id: profileResponse.data.user.id || profileResponse.data.user._id
                });
                if (isMounted) {
                  setIsAdmin(true);
                  setIsChecking(false);
                }
              } else {
                // Not admin
                if (isMounted && !hasRedirectedRef.current) {
                  setIsChecking(false);
                  setIsAdmin(false);
                  hasRedirectedRef.current = true;
                  router.push('/');
                }
              }
            } catch (fallbackError: any) {
              // If fallback also fails with 401, clear auth
              if (fallbackError.response?.status === 401) {
                useAuthStore.getState().logout();
              }
              if (isMounted && !hasRedirectedRef.current) {
                setIsChecking(false);
                setIsAdmin(false);
                hasRedirectedRef.current = true;
                router.push('/');
              }
            }
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (isMounted && !hasRedirectedRef.current) {
          setIsChecking(false);
          setIsAdmin(false);
          hasRedirectedRef.current = true;
          router.push('/');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run once on mount, never re-check

  return { isAdmin, isChecking };
}
