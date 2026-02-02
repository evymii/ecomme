'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

export function useAdminAuth() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // If no user in store, try to fetch from API
        if (!user) {
          const token = localStorage.getItem('token');
          if (!token) {
            if (isMounted) {
              setIsChecking(false);
              router.push('/');
            }
            return;
          }

          try {
            const response = await api.get('/users/profile');
            if (response.data.success && response.data.user) {
              const fetchedUser = response.data.user;
              useAuthStore.getState().setUser(fetchedUser);
              
              if (isMounted) {
                if (fetchedUser.role === 'admin') {
                  setIsAdmin(true);
                  setIsChecking(false);
                } else {
                  setIsChecking(false);
                  router.push('/');
                }
              }
              return;
            }
          } catch (error) {
            console.error('Auth check failed:', error);
            if (isMounted) {
              setIsChecking(false);
              router.push('/');
            }
            return;
          }
        }

        // Check if user is admin
        if (user && user.role === 'admin') {
          if (isMounted) {
            setIsAdmin(true);
            setIsChecking(false);
          }
        } else {
          if (isMounted) {
            setIsChecking(false);
            router.push('/');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (isMounted) {
          setIsChecking(false);
          router.push('/');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [user, router]);

  return { isAdmin, isChecking };
}
