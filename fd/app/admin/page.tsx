'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';

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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Шалгаж байна...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // This will redirect, so return null
  return null;
}