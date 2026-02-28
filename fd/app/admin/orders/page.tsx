'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Header from '@/components/layout/Header';
import { getImageUrl } from '@/lib/image-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Loader from '@/components/ui/Loader';
import { PageLoader } from '@/components/ui/Loader';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import OrderReceipt from '@/components/admin/OrderReceipt';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useAuthStore } from '@/store/auth-store';

interface Order {
  _id: string;
  user?: {
    name: string;
    phoneNumber: string;
    email?: string;
  };
  phoneNumber?: string; // For guest orders
  email?: string; // For guest orders
  customerName?: string; // For guest orders
  items: Array<{
    product: { name: string; price?: number; code?: string; images?: Array<{ url: string; isMain: boolean }> };
    quantity: number;
    price: number;
    size?: string;
  }>;
  total: number;
  deliveryAddress: {
    address: string;
    additionalInfo?: string;
  };
  paymentMethod?: string;
  orderCode?: string;
  status: string;
  createdAt: string;
}

export default function AdminOrdersPage() {
  // Helper function to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Initialize with today's date
  const today = new Date();
  const todayFormatted = formatDate(today);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoader = useDelayedLoading(loading, 250);
  const [startDate, setStartDate] = useState(todayFormatted);
  const [endDate, setEndDate] = useState(todayFormatted);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const { isAdmin, isChecking } = useAdminAuth();
  const { toast } = useToast();
  const logout = useAuthStore((state) => state.logout);

  // Set date range helper functions
  const setDateRange = (start: Date, end: Date) => {
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  const setOneWeek = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    setDateRange(start, end);
  };

  const setOneMonth = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    setDateRange(start, end);
  };

  const fetchOrders = useCallback(async ({ showErrorToast = true }: { showErrorToast?: boolean } = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await api.get(`/admin/orders?${params.toString()}`, {
        timeout: 30000,
      });
      
      if (response.data.success) {
        setOrders(response.data.orders || []);
        return true;
      } else {
        if (showErrorToast) {
          toast({
            title: 'Алдаа',
            description: response.data?.message || 'Захиалгууд авахад алдаа гарлаа',
            variant: 'destructive',
          });
        }
        return false;
      }
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
        router.push('/');
        return false;
      }
      if (showErrorToast) {
        toast({
          title: 'Алдаа',
          description: error.response?.data?.message || 'Захиалгууд авахад алдаа гарлаа',
          variant: 'destructive',
        });
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, toast]);

  useEffect(() => {
    if (isAdmin && !isChecking) {
      fetchOrders();
    }
  }, [isAdmin, isChecking, fetchOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status: newStatus });
      const refreshed = await fetchOrders({ showErrorToast: false });
      toast({
        title: 'Амжилттай',
        description: refreshed
          ? 'Захиалгын төлөв шинэчлэгдлээ'
          : 'Захиалгын төлөв шинэчлэгдсэн боловч жагсаалт шинэчлэхэд алдаа гарлаа',
      });
    } catch (error: any) {
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Алдаа гарлаа',
        variant: 'destructive',
      });
    }
  };

  const openDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
    setShowReceipt(false);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Хүлээгдэж буй',
      processing: 'Бэлтгэж байна',
      shipped: 'Илгээсэн',
      delivered: 'Хүргэсэн',
      cancelled: 'Цуцлагдсан',
    };
    return labels[status] || status;
  };

  const getPaymentMethodLabel = (method?: string) => {
    const labels: Record<string, string> = {
      pay_later: 'Дараа төлөх',
      paid_personally: 'Биечлэн төлсөн',
      bank_transfer: 'Банкны шилжүүлэг',
    };
    return labels[method || ''] || method || '-';
  };

  if (isChecking) {
    return <Loader />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-4 md:mb-8">
          <h1 className="text-xl md:text-3xl font-semibold md:font-bold">Захиалга</h1>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-32 md:w-36 text-xs md:text-sm"
              />
              <span className="text-sm text-gray-600">-</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-32 md:w-36 text-xs md:text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={setOneWeek}
                className="text-xs md:text-sm whitespace-nowrap"
              >
                1 долоо хоног
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setOneMonth}
                className="text-xs md:text-sm whitespace-nowrap"
              >
                1 сар
              </Button>
            </div>
          </div>
        </div>

        {loading && showLoader ? (
          <PageLoader />
        ) : loading ? null : (
          <Card>
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg font-semibold md:font-bold">
                Захиалгууд ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              {orders.length === 0 ? (
                <div className="text-center py-8 md:py-12 text-sm md:text-base text-gray-500">
                  Захиалга олдсонгүй
                </div>
              ) : (
                <div className="overflow-x-auto -mx-3 md:mx-0">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium">№</th>
                        <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium">ЗАХИАЛГЫН КОД</th>
                        <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium">УТАСНЫ ДУГААР</th>
                        <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium">БАРААНУУД</th>
                        <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium">НИЙТ</th>
                        <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium">ТӨЛӨВ</th>
                        <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium">ҮЙЛДЛҮҮД</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order, index) => (
                        <tr key={order._id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 md:py-3 md:px-4">{index + 1}</td>
                          <td className="py-2 px-2 md:py-3 md:px-4 font-medium">
                            {order.orderCode || '-'}
                          </td>
                          <td className="py-2 px-2 md:py-3 md:px-4">
                            {order.user?.phoneNumber || order.phoneNumber || '-'}
                          </td>
                          <td className="py-2 px-2 md:py-3 md:px-4">
                            <div className="space-y-1">
                              {(order.items || []).slice(0, 2).map((item, idx) => (
                                <div key={idx} className="text-xs">
                                  {item.product?.name || 'Устгагдсан бараа'} × {item.quantity}
                                </div>
                              ))}
                              {(order.items || []).length > 2 && (
                                <div className="text-xs text-gray-500">
                                  +{order.items.length - 2} бараа
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 md:py-3 md:px-4 font-semibold">
                            ₮{(order.total || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-2 md:py-3 md:px-4">
                            <Select
                              value={order.status}
                              onValueChange={(value) => handleStatusChange(order._id, value)}
                            >
                              <SelectTrigger className="w-28 md:w-36 h-8 md:h-10 text-xs md:text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Хүлээгдэж буй</SelectItem>
                                <SelectItem value="processing">Бэлтгэж байна</SelectItem>
                                <SelectItem value="shipped">Илгээсэн</SelectItem>
                                <SelectItem value="delivered">Хүргэсэн</SelectItem>
                                <SelectItem value="cancelled">Цуцлагдсан</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-2 md:py-3 md:px-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDetails(order)}
                              className="text-xs md:text-sm"
                            >
                              Дэлгэрэнгүй
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Details Modal */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Захиалгын дэлгэрэнгүй мэдээлэл</DialogTitle>
              <DialogDescription>
                Захиалгын бүх мэдээллийг доор харна уу
              </DialogDescription>
            </DialogHeader>
            
            {selectedOrder && (
              <div>
                {/* Tabs */}
                <div className="flex gap-2 mb-4 border-b">
                  <button
                    onClick={() => setShowReceipt(false)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      !showReceipt
                        ? 'border-b-2 border-black text-black'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Дэлгэрэнгүй
                  </button>
                  <button
                    onClick={() => setShowReceipt(true)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      showReceipt
                        ? 'border-b-2 border-black text-black'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Баримт хэвлэх
                  </button>
                </div>

                {showReceipt ? (
                  <OrderReceipt order={selectedOrder} />
                ) : (
                  <div className="space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Захиалгын код</p>
                    <p className="text-base font-semibold">{selectedOrder.orderCode || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Огноо</p>
                    <p className="text-base">{new Date(selectedOrder.createdAt).toLocaleString('mn-MN')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Төлөв</p>
                    <p className="text-base">{getStatusLabel(selectedOrder.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Төлбөрийн хэлбэр</p>
                    <p className="text-base">{getPaymentMethodLabel(selectedOrder.paymentMethod)}</p>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Захиалагчийн мэдээлэл</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Нэр</p>
                      <p className="text-base">{selectedOrder.user?.name || selectedOrder.customerName || 'Зочин'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Утасны дугаар</p>
                      <p className="text-base">{selectedOrder.user?.phoneNumber || selectedOrder.phoneNumber || '-'}</p>
                    </div>
                    {(selectedOrder.user?.email || selectedOrder.email) && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">Имэйл</p>
                        <p className="text-base">{selectedOrder.user?.email || selectedOrder.email}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Хүргэлтийн хаяг</h3>
                  <p className="text-base">{selectedOrder.deliveryAddress?.address || '-'}</p>
                  {selectedOrder.deliveryAddress?.additionalInfo && (
                    <p className="text-sm text-gray-600 mt-2">
                      Нэмэлт: {selectedOrder.deliveryAddress.additionalInfo}
                    </p>
                  )}
                </div>

                {/* Order Items */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Захиалгын бараанууд</h3>
                  <div className="space-y-3">
                    {(selectedOrder.items || []).map((item, idx) => {
                      const product = item.product;
                      const mainImg = product?.images?.find(img => img.isMain) || product?.images?.[0];
                      return (
                        <div key={idx} className="flex items-center gap-3 pb-3 border-b last:border-0">
                          {/* Product Image */}
                          <div className="relative w-12 h-12 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                            {mainImg ? (
                              <Image
                                src={getImageUrl(mainImg.url)}
                                alt={product?.name || 'Бараа'}
                                fill
                                className="object-cover"
                                unoptimized
                                sizes="48px"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-[8px]">
                                No img
                              </div>
                            )}
                          </div>
                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{product?.name || 'Устгагдсан бараа'}</p>
                            {product?.code && (
                              <p className="text-xs text-gray-500">Код: {product.code}</p>
                            )}
                            <p className="text-xs text-gray-600">
                              Тоо ширхэг: {item.quantity}
                              {item.size && ` • Хэмжээ: ${item.size}`}
                            </p>
                          </div>
                          {/* Price */}
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-sm">₮{((item.price || 0) * (item.quantity || 0)).toLocaleString()}</p>
                            <p className="text-xs text-gray-500">₮{(item.price || 0).toLocaleString()} × {item.quantity}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-semibold">Нийт дүн:</p>
                    <p className="text-xl font-bold">₮{(selectedOrder.total || 0).toLocaleString()}</p>
                  </div>
                </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
