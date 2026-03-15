'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getCache, setCache, clearCache } from '@/lib/admin-cache';

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
  } | string;
  paymentMethod?: string;
  payment?: {
    method?: string;
    paymentMethod?: string;
  };
  address?: {
    deliveryAddress?: string;
    additionalInfo?: string;
  } | string;
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
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const { isAdmin, isChecking } = useAdminAuth();
  const { toast } = useToast();

  const getRequestErrorMessage = (error: any, fallback: string) => {
    const status = error?.response?.status;
    const backendMessage = error?.response?.data?.message;
    if (backendMessage && status) return `${backendMessage} (HTTP ${status})`;
    if (backendMessage) return backendMessage;
    if (status) return `${fallback} (HTTP ${status})`;
    if (error?.code === 'ECONNABORTED') return 'Хүсэлт хэт удлаа (timeout). Дахин оролдоно уу.';
    if (error?.message) return `${fallback}: ${error.message}`;
    return fallback;
  };

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchFilter(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const displayedOrders = useMemo(() => {
    const query = searchInput.trim().replace(/\s+/g, '');
    if (!query) return orders;

    const isLikelyFullPhone = /^\d{8,}$/.test(query);

    return orders.filter((order) => {
      const orderCode = (order.orderCode || '').toString().replace(/\s+/g, '');
      const phone = ((order.user?.phoneNumber || order.phoneNumber || '') as string).replace(/\s+/g, '');

      if (isLikelyFullPhone) {
        return phone === query;
      }

      return orderCode.startsWith(query) || phone.startsWith(query);
    });
  }, [orders, searchInput]);

  useEffect(() => {
    const visibleIds = new Set(displayedOrders.map((order) => order._id));
    setSelectedOrderIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [displayedOrders]);

  const getCacheKey = useCallback(() => {
    const params = new URLSearchParams();
    if (startDate) params.append('s', startDate);
    if (endDate) params.append('e', endDate);
    if (searchFilter) params.append('q', searchFilter);
    return `admin_orders_${params.toString()}`;
  }, [startDate, endDate, searchFilter]);

  const fetchOrders = useCallback(async ({ showErrorToast = true, skipCache = false }: { showErrorToast?: boolean; skipCache?: boolean } = {}) => {
    const cacheKey = getCacheKey();

    // Try cache first (only on initial load, not after mutations)
    if (!skipCache) {
      const cached = getCache<Order[]>(cacheKey, 30_000);
      if (cached) {
        setOrders(cached);
        setLoading(false);
        // Background refresh
        api.get(`/admin/orders?${new URLSearchParams({ ...(startDate && { startDate }), ...(endDate && { endDate }), ...(searchFilter && { search: searchFilter }) }).toString()}`, { timeout: 30000 })
          .then(res => {
            if (res.data.success) {
              setOrders(res.data.orders || []);
              setCache(cacheKey, res.data.orders || []);
            }
          })
          .catch(() => {});
        return true;
      }
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchFilter) params.append('search', searchFilter);

      const response = await api.get(`/admin/orders?${params.toString()}`, {
        timeout: 30000,
      });

      if (response.data.success) {
        const ordersData = response.data.orders || [];
        setOrders(ordersData);
        setCache(cacheKey, ordersData);
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
        if (showErrorToast) {
          toast({
            title: 'Анхааруулга',
            description: 'Энэ үйлдэлд нэвтрэх эрх хүрэлцэхгүй байна.',
            variant: 'destructive',
          });
        }
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
  }, [startDate, endDate, searchFilter, toast, getCacheKey]);

  useEffect(() => {
    if (isAdmin && !isChecking) {
      fetchOrders();
    }
  }, [isAdmin, isChecking, fetchOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status: newStatus });
      clearCache(getCacheKey());
      const refreshed = await fetchOrders({ showErrorToast: false, skipCache: true });
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

  const handleDeleteOrder = async (orderId: string) => {
    const confirmed = window.confirm('Энэ захиалгыг устгахдаа итгэлтэй байна уу?');
    if (!confirmed) return;

    try {
      setDeletingOrderId(orderId);
      const response = await api.delete(`/admin/orders/${orderId}`);
      toast({
        title: 'Амжилттай',
        description: response.data?.message || 'Захиалга устгагдлаа',
      });
      if (selectedOrder?._id === orderId) {
        setIsDetailsOpen(false);
        setSelectedOrder(null);
      }
      clearCache(getCacheKey());
      await fetchOrders({ showErrorToast: false, skipCache: true });
      setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
    } catch (error: any) {
      console.error('Delete single order failed:', {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      toast({
        title: 'Алдаа',
        description: getRequestErrorMessage(error, 'Захиалга устгахад алдаа гарлаа'),
        variant: 'destructive',
      });
    } finally {
      setDeletingOrderId(null);
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const allDisplayedSelected =
    displayedOrders.length > 0 && displayedOrders.every((order) => selectedOrderIds.includes(order._id));

  const toggleSelectAllDisplayed = () => {
    if (allDisplayedSelected) {
      setSelectedOrderIds([]);
      return;
    }
    setSelectedOrderIds(displayedOrders.map((order) => order._id));
  };

  const handleDeleteSelectedOrders = async () => {
    if (selectedOrderIds.length === 0) {
      toast({
        title: 'Анхааруулга',
        description: 'Устгах захиалгаа эхлээд сонгоно уу',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = window.confirm(
      `${selectedOrderIds.length} захиалгыг устгахдаа итгэлтэй байна уу?`
    );
    if (!confirmed) return;

    try {
      setDeletingSelected(true);
      const idsToDelete = [...selectedOrderIds];
      let deletedCount = 0;
      try {
        const response = await api.delete('/admin/orders', {
          timeout: 30000,
          params: {
            mode: 'selected',
            orderIds: idsToDelete.join(','),
          },
        });
        deletedCount = Number(response.data?.deletedCount || 0);
      } catch (bulkError: any) {
        console.warn('Bulk selected delete failed. Falling back to per-order delete.', {
          message: bulkError?.message,
          status: bulkError?.response?.status,
          data: bulkError?.response?.data,
        });
        const settled = await Promise.allSettled(
          idsToDelete.map((id) => api.delete(`/admin/orders/${id}`, { timeout: 30000 }))
        );
        deletedCount = settled.filter((r) => r.status === 'fulfilled').length;
      }

      const deletedSet = new Set(idsToDelete);
      if (deletedCount > 0) {
        setOrders((prev) => prev.filter((order) => !deletedSet.has(order._id)));
        if (selectedOrder && deletedSet.has(selectedOrder._id)) {
          setSelectedOrder(null);
          setIsDetailsOpen(false);
        }
      }
      setSelectedOrderIds([]);

      toast({
        title: deletedCount > 0 ? 'Амжилттай' : 'Анхааруулга',
        description:
          deletedCount > 0
            ? `${deletedCount} захиалга устгагдлаа`
            : 'Сонгосон захиалгуудаас устгах боломжтой захиалга олдсонгүй',
        variant: deletedCount > 0 ? undefined : 'destructive',
      });

      clearCache(getCacheKey());
      await fetchOrders({ showErrorToast: false, skipCache: true });
    } catch (error: any) {
      console.error('Delete selected orders failed:', {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      toast({
        title: 'Алдаа',
        description: getRequestErrorMessage(error, 'Сонгосон захиалгууд устгахад алдаа гарлаа'),
        variant: 'destructive',
      });
    } finally {
      setDeletingSelected(false);
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

  const getOrderPaymentMethod = (order: Order) => {
    return order.paymentMethod || order.payment?.method || order.payment?.paymentMethod;
  };

  const getOrderDeliveryAddress = (order: Order) => {
    if (!order.deliveryAddress) return '-';
    if (typeof order.deliveryAddress === 'string') return order.deliveryAddress;
    if (order.deliveryAddress.address) return order.deliveryAddress.address;
    if (typeof order.address === 'string') return order.address;
    if (order.address?.deliveryAddress) return order.address.deliveryAddress;
    return '-';
  };

  const getOrderAddressAdditionalInfo = (order: Order) => {
    if (typeof order.deliveryAddress === 'object' && order.deliveryAddress?.additionalInfo) {
      return order.deliveryAddress.additionalInfo;
    }
    if (typeof order.address === 'object' && order.address?.additionalInfo) {
      return order.address.additionalInfo;
    }
    return '';
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

        <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center mb-4 md:mb-8">
          <div className="md:flex-1 md:flex md:justify-start">
            <h1 className="text-xl md:text-3xl font-semibold md:font-bold">Захиалга</h1>
          </div>

          <div className="w-full md:w-[420px] lg:w-[460px]">
            <Input
              id="admin-order-search"
              name="adminOrderSearch"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Захиалгын код эсвэл утасны дугаар..."
              autoComplete="off"
              className="w-full text-xs md:text-sm"
            />
          </div>

          <div className="md:flex-1 md:flex md:justify-end">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex gap-2 items-center">
                <Input
                  id="admin-order-start-date"
                  name="adminOrderStartDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  autoComplete="off"
                  className="w-32 md:w-36 text-xs md:text-sm"
                />
                <span className="text-sm text-gray-600">-</span>
                <Input
                  id="admin-order-end-date"
                  name="adminOrderEndDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  autoComplete="off"
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteSelectedOrders}
                  disabled={deletingSelected || selectedOrderIds.length === 0}
                  className="text-xs md:text-sm whitespace-nowrap border-red-400 text-red-700 hover:bg-red-50"
                >
                  {deletingSelected ? 'Устгаж байна...' : `Устгах (${selectedOrderIds.length})`}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {loading && showLoader ? (
          <PageLoader />
        ) : loading ? null : (
          <Card>
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg font-semibold md:font-bold">
                Захиалгууд ({displayedOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              {displayedOrders.length === 0 ? (
                <div className="text-center py-8 md:py-12 text-sm md:text-base text-gray-500">
                  Захиалга олдсонгүй
                </div>
              ) : (
                <div className="overflow-x-auto -mx-3 md:mx-0">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium w-10">
                          <input
                            id="admin-order-select-all"
                            name="adminOrderSelectAll"
                            type="checkbox"
                            checked={allDisplayedSelected}
                            onChange={toggleSelectAllDisplayed}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </th>
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
                      {displayedOrders.map((order, index) => (
                        <tr key={order._id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 md:py-3 md:px-4">
                            <input
                              id={`admin-order-select-${order._id}`}
                              name={`adminOrderSelect-${order._id}`}
                              type="checkbox"
                              checked={selectedOrderIds.includes(order._id)}
                              onChange={() => toggleSelectOrder(order._id)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
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
                    <p className="text-base">{getPaymentMethodLabel(getOrderPaymentMethod(selectedOrder))}</p>
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
                  <p className="text-base">{getOrderDeliveryAddress(selectedOrder)}</p>
                  {getOrderAddressAdditionalInfo(selectedOrder) && (
                    <p className="text-sm text-gray-600 mt-2">
                      Нэмэлт: {getOrderAddressAdditionalInfo(selectedOrder)}
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
                <div className="border-t pt-4 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteOrder(selectedOrder._id)}
                    disabled={deletingOrderId === selectedOrder._id}
                    className="border-red-500 text-red-700 hover:bg-red-50"
                  >
                    {deletingOrderId === selectedOrder._id ? 'Устгаж байна...' : 'Энэ захиалгыг устгах'}
                  </Button>
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
