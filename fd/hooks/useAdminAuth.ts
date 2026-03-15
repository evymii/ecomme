'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

function setAdminCookie(verified: boolean) {
  if (typeof document === 'undefined') return;
  if (verified) {
    document.cookie = `admin_verified=true; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  } else {
    document.cookie = 'admin_verified=; path=/; max-age=0; SameSite=Lax';
  }
}

export function useAdminAuth() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const storeState = useAuthStore.getState();
        const token = storeState.token || localStorage.getItem('token');

        if (!token) {
          setAdminCookie(false);
          if (isMounted) {
            setIsAdmin(false);
            setIsChecking(false);
            router.push('/');
          }
          return;
        }

        if (!storeState.token && token) {
          useAuthStore.getState().setToken(token);
        }

        try {
          const response = await api.get('/admin/check');
          if (isMounted) {
            if (response.data.success && response.data.isAdmin) {
              if (response.data.user) {
                useAuthStore.getState().setUser({
                  id: response.data.user.id,
                  role: response.data.user.role,
                  phoneNumber: response.data.user.phoneNumber || '',
                  email: response.data.user.email || '',
                  name: response.data.user.name || '',
                });
              }
              setAdminCookie(true);
              setIsAdmin(true);
              setIsChecking(false);
            } else {
              setAdminCookie(false);
              setIsAdmin(false);
              setIsChecking(false);
              router.push('/');
            }
          }
        } catch (error: any) {
          // Fallback to profile endpoint
          try {
            const profileResponse = await api.get('/users/profile');
            if (isMounted && profileResponse.data.success && profileResponse.data.user?.role === 'admin') {
              useAuthStore.getState().setUser({
                ...profileResponse.data.user,
                id: profileResponse.data.user.id || profileResponse.data.user._id,
              });
              setAdminCookie(true);
              setIsAdmin(true);
              setIsChecking(false);
              return;
            }
          } catch (_) {}

          if (isMounted) {
            setAdminCookie(false);
            setIsAdmin(false);
            setIsChecking(false);
            if (error.response?.status === 401 || error.response?.status === 403) {
              router.push('/');
            }
          }
        }
      } catch (error) {
        if (isMounted) {
          setAdminCookie(false);
          setIsAdmin(false);
          setIsChecking(false);
          router.push('/');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return { isAdmin, isChecking };
}
