'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Sidebar from '@/components/profile/Sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';

export default function OrdersPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const userRole = user?.role;
  useEffect(() => {
    if (userRole === 'admin') {
      router.push('/admin/orders');
    }
  }, [userRole, router]);
  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col">
      <Header />
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <Sidebar />
          <div className="flex-1">
            <Card>
              <CardContent className="p-4 md:p-12">
                <div className="flex flex-col items-center justify-center py-8 md:py-12">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4 md:mb-6">
                    <Package className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
                  </div>
                  <h2 className="text-lg md:text-2xl font-semibold md:font-bold mb-2">Захиалга байхгүй</h2>
                  <p className="text-xs md:text-base text-gray-500 mb-4 md:mb-6 text-center px-2">
                    Та одоогоор захиалга хийгээгүй байна
                  </p>
                  <Link href="/products">
                    <Button size="sm" className="text-xs md:text-sm">Бараа үзэх</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
