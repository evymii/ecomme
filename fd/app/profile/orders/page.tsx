'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Sidebar from '@/components/profile/Sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { getImageUrl } from '@/lib/image-utils';
import { PageLoader } from '@/components/ui/Loader';
import api from '@/lib/api';

interface OrderProduct {
  _id: string;
  name: string;
  price: number;
  code?: string;
  images?: Array<{ url: string; isMain: boolean }>;
}

interface OrderItem {
  product: OrderProduct;
  quantity: number;
  price: number;
  size?: string;
}

interface Order {
  _id: string;
  orderCode?: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: string;
  createdAt: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Бэлдэж буй', color: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'Хүргэлтэнд', color: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Хүргэгдсэн', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-100 text-red-800' },
};

export default function OrdersPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const userRole = user?.role;
  const userId = user ? 'exists' : null;

  useEffect(() => {
    if (userRole === 'admin') {
      router.push('/admin/orders');
      return;
    }
    if (!userId) {
      router.push('/');
      return;
    }
  }, [userRole, userId, router]);

  useEffect(() => {
    if (!userId || userRole === 'admin') return;
    const fetchOrders = async () => {
      try {
        const response = await api.get('/users/orders');
        if (response.data.success) {
          setOrders(response.data.orders || []);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [userId, userRole]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col">
      <Header />
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 flex-1">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <Sidebar />
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Миний захиалгууд</h1>

            {loading ? (
              <PageLoader />
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="p-4 md:p-12">
                  <div className="flex flex-col items-center justify-center py-8 md:py-12">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4 md:mb-6">
                      <Package className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
                    </div>
                    <h2 className="text-lg md:text-2xl font-semibold mb-2">Захиалга байхгүй</h2>
                    <p className="text-xs md:text-base text-gray-500 mb-4 md:mb-6 text-center px-2">
                      Та одоогоор захиалга хийгээгүй байна
                    </p>
                    <Link href="/products">
                      <Button size="sm" className="text-xs md:text-sm">Бараа үзэх</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const statusInfo = statusMap[order.status] || statusMap.pending;
                  const date = new Date(order.createdAt);
                  const formattedDate = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

                  return (
                    <Card key={order._id} className="overflow-hidden">
                      <CardContent className="p-0">
                        {/* Order header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-b">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-medium text-[#02111B]">#{order.orderCode || order._id.slice(-6)}</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-gray-500">{formattedDate}</span>
                          </div>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>

                        {/* Order items */}
                        <div className="px-4 py-3 space-y-3">
                          {order.items.map((item, idx) => {
                            const mainImage = item.product?.images?.find(img => img.isMain) || item.product?.images?.[0];
                            return (
                              <div key={idx} className="flex items-center gap-3">
                                <div className="relative w-14 h-14 md:w-16 md:h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                  {mainImage ? (
                                    <Image
                                      src={getImageUrl(mainImage.url)}
                                      alt={item.product?.name || 'Product'}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                      sizes="64px"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">Зураг</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#02111B] truncate">
                                    {item.product?.name || 'Бүтээгдэхүүн'}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {item.product?.code && (
                                      <span className="text-xs text-gray-400">{item.product.code}</span>
                                    )}
                                    {item.size && (
                                      <span className="text-xs text-gray-400">| {item.size}</span>
                                    )}
                                    <span className="text-xs text-gray-500">x{item.quantity}</span>
                                  </div>
                                </div>
                                <span className="text-sm font-medium text-[#02111B] whitespace-nowrap">
                                  ₮{(item.price * item.quantity).toLocaleString()}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Order footer */}
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                          <span className="text-xs text-gray-500">
                            {order.items.reduce((sum, i) => sum + i.quantity, 0)} бараа
                          </span>
                          <span className="text-sm font-semibold text-[#02111B]">
                            Нийт: ₮{order.total.toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
