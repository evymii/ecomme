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
    // Prevent multiple simultaneous checks
    if (hasCheckedRef.current) return;
    
    let isMounted = true;
    hasCheckedRef.current = true;

    const checkAuth = async () => {
      try {
        // Quick check: if user is already in store and is admin
        // This check happens synchronously, so it's fast
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.role === 'admin') {
          if (isMounted) {
            setIsAdmin(true);
            setIsChecking(false);
            hasCheckedRef.current = false; // Reset after successful check
          }
          return;
        }

        // Check if token exists
        const token = localStorage.getItem('token');
        if (!token) {
          if (isMounted && !hasRedirectedRef.current) {
            setIsChecking(false);
            setIsAdmin(false);
            hasCheckedRef.current = false;
            hasRedirectedRef.current = true;
            router.push('/');
          }
          return;
        }

        // Use dedicated admin check endpoint (faster and lighter)
        try {
          const response = await api.get('/admin/check');
          if (response.data.success && response.data.isAdmin) {
            // Update user in store if needed
            if (response.data.user && !user) {
              useAuthStore.getState().setUser({
                id: response.data.user.id,
                role: response.data.user.role,
                phoneNumber: '',
                email: '',
                name: ''
              });
            }
            
            if (isMounted) {
              setIsAdmin(true);
              setIsChecking(false);
              hasCheckedRef.current = false;
            }
          } else {
            if (isMounted && !hasRedirectedRef.current) {
              setIsChecking(false);
              setIsAdmin(false);
              hasCheckedRef.current = false;
              hasRedirectedRef.current = true;
              router.push('/');
            }
          }
        } catch (error: any) {
          console.error('Admin auth check failed:', error);
          // If 401/403, user is not admin or not authenticated
          if (error.response?.status === 401 || error.response?.status === 403) {
            if (isMounted && !hasRedirectedRef.current) {
              setIsChecking(false);
              setIsAdmin(false);
              hasCheckedRef.current = false;
              hasRedirectedRef.current = true;
              router.push('/');
            }
          } else {
            // Network error - try fallback to profile endpoint
            try {
              const profileResponse = await api.get('/users/profile');
              if (profileResponse.data.success && profileResponse.data.user?.role === 'admin') {
                useAuthStore.getState().setUser(profileResponse.data.user);
                if (isMounted) {
                  setIsAdmin(true);
                  setIsChecking(false);
                  hasCheckedRef.current = false;
                }
              } else {
                if (isMounted && !hasRedirectedRef.current) {
                  setIsChecking(false);
                  setIsAdmin(false);
                  hasCheckedRef.current = false;
                  hasRedirectedRef.current = true;
                  router.push('/');
                }
              }
            } catch (fallbackError) {
              if (isMounted && !hasRedirectedRef.current) {
                setIsChecking(false);
                setIsAdmin(false);
                hasCheckedRef.current = false;
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
          hasCheckedRef.current = false;
          hasRedirectedRef.current = true;
          router.push('/');
        }
      }
    };

    // Clear any existing timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    checkAuth();

    // Reset check flag after a delay to allow re-check if needed (e.g., after login)
    checkTimeoutRef.current = setTimeout(() => {
      hasCheckedRef.current = false;
    }, 2000);

    return () => {
      isMounted = false;
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  return { isAdmin, isChecking };
}
