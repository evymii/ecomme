'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Loader from '@/components/ui/Loader';

export default function AdminDashboard() {
  const router = useRouter();
  const { isAdmin, isChecking } = useAdminAuth();

  useEffect(() => {
    if (!isChecking && isAdmin) {
      // Redirect to orders page
      router.replace('/admin/orders');
    }
  }, [isAdmin, isChecking, router]);

  if (isChecking) {
    return <Loader />;
  }

  if (!isAdmin) {
    return null;
  }

  // This will redirect, so return null
  return null;
}