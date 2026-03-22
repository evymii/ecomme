'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import Header from '@/components/layout/Header';
import { getImageUrl } from '@/lib/image-utils';
import Loader from '@/components/ui/Loader';
import { PageLoader } from '@/components/ui/Loader';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import OrderReceipt from '@/components/admin/OrderReceipt';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { getCache, setCache, clearCache } from '@/lib/admin-cache';
import { cn } from '@/lib/utils';

interface Order {
  _id: string;
  user?: {
    name: string;
    phoneNumber: string;
    email?: string;
  };
  phoneNumber?: string;
  email?: string;
  customerName?: string;
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

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateDots(iso: string): string {
  return iso.replace(/-/g, '.');
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconPhone({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v.01M12 11v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconImagePlaceholder({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="9.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const selectChevronSvg =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23555' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export default function AdminOrdersPage() {
  const today = new Date();
  const todayFormatted = formatDate(today);

  const monthInitial = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return { start: formatDate(start), end: formatDate(end) };
  }, []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoader = useDelayedLoading(loading, 250);
  const [startDate, setStartDate] = useState(monthInitial.start);
  const [endDate, setEndDate] = useState(monthInitial.end);
  const [quickRange, setQuickRange] = useState<'week' | 'month' | null>('month');
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

  const selectAllRef = useRef<HTMLInputElement>(null);
  const dateFromInputRef = useRef<HTMLInputElement>(null);
  const dateToInputRef = useRef<HTMLInputElement>(null);

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

  const setDateRange = (start: Date, end: Date) => {
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  const setOneWeek = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    setDateRange(start, end);
    setQuickRange('week');
  };

  const setOneMonth = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    setDateRange(start, end);
    setQuickRange('month');
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

  const selectedCount = selectedOrderIds.length;

  const selectedOnPageCount = useMemo(
    () => displayedOrders.filter((o) => selectedOrderIds.includes(o._id)).length,
    [displayedOrders, selectedOrderIds]
  );

  const allDisplayedSelected =
    displayedOrders.length > 0 && selectedOnPageCount === displayedOrders.length;

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const n = displayedOrders.length;
    el.indeterminate = selectedOnPageCount > 0 && selectedOnPageCount < n;
  }, [displayedOrders.length, selectedOnPageCount]);

  const getCacheKey = useCallback(() => {
    const params = new URLSearchParams();
    if (startDate) params.append('s', startDate);
    if (endDate) params.append('e', endDate);
    if (searchFilter) params.append('q', searchFilter);
    return `admin_orders_${params.toString()}`;
  }, [startDate, endDate, searchFilter]);

  const fetchOrders = useCallback(
    async ({ showErrorToast = true, skipCache = false }: { showErrorToast?: boolean; skipCache?: boolean } = {}) => {
      const cacheKey = getCacheKey();

      if (!skipCache) {
        const cached = getCache<Order[]>(cacheKey, 30_000);
        if (cached) {
          setOrders(cached);
          setLoading(false);
          api
            .get(
              `/admin/orders?${new URLSearchParams({
                ...(startDate && { startDate }),
                ...(endDate && { endDate }),
                ...(searchFilter && { search: searchFilter }),
              }).toString()}`,
              { timeout: 30000 }
            )
            .then((res) => {
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
    },
    [startDate, endDate, searchFilter, toast, getCacheKey]
  );

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

  const onSelectAllChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(displayedOrders.map((o) => o._id));
    } else {
      setSelectedOrderIds([]);
    }
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

    const confirmed = window.confirm(`${selectedOrderIds.length} захиалгыг устгахдаа итгэлтэй байна уу?`);
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

  const closeSheet = () => {
    setIsDetailsOpen(false);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Хүлээгдэж буй',
      processing: 'Бэлтгэж байна',
      shipped: 'Хүргэлтэд гарсан',
      delivered: 'Дууссан',
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

  const selectAllContextLabel = useMemo(() => {
    if (startDate === endDate && startDate === todayFormatted) {
      return `Өнөөдөр · ${displayedOrders.length} захиалга`;
    }
    return `${formatDateDots(startDate)} — ${formatDateDots(endDate)}`;
  }, [startDate, endDate, todayFormatted, displayedOrders.length]);

  const formatOrderDateTime = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} · ${h}:${min}`;
  };

  const customerDisplay = (order: Order) => {
    const phone = order.user?.phoneNumber || order.phoneNumber || '';
    const name = order.user?.name || order.customerName || '';
    return { phone: phone || '-', name };
  };

  const itemPreviewLine = (order: Order) => {
    const items = order.items || [];
    const parts = items.slice(0, 2).map((it) => `${it.product?.name || 'Устгагдсан бараа'} × ${it.quantity}`);
    const more = items.length > 2 ? items.length - 2 : 0;
    return { parts, more };
  };

  if (isChecking) {
    return <Loader />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto max-w-lg pb-8">
        <header className="sticky top-0 z-10 border-b border-[#efefef] bg-white px-[14px] pb-[9px] pt-[11px]">
          <h1 className="mb-[7px] text-[16px] font-medium leading-tight text-[#111]">Захиалга</h1>
          <div className="relative mb-[7px]">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#bbb]">
              <IconSearch className="text-[#bbb]" />
            </span>
            <input
              id="admin-order-search"
              name="adminOrderSearch"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Захиалгын код эсвэл утасны дугаар..."
              autoComplete="off"
              className="h-[34px] w-full rounded-lg border border-[#e8e8e8] bg-[#f7f7f7] pl-9 pr-3 text-[11px] text-[#111] placeholder:text-[11px] placeholder:text-[#c0c0c0] outline-none focus:border-[#ccc]"
            />
          </div>
          <div className="-mx-0 flex max-w-full flex-nowrap items-center gap-[5px] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => {
                const el = dateFromInputRef.current;
                if (!el) return;
                if (typeof el.showPicker === 'function') el.showPicker();
                else el.click();
              }}
              className="flex h-7 shrink-0 items-center gap-1 rounded-[7px] border border-[#e4e4e4] bg-white px-2 text-[10px] text-[#666]"
            >
              <IconCalendar className="text-[#666]" />
              {formatDateDots(startDate)}
            </button>
            <input
              ref={dateFromInputRef}
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setQuickRange(null);
              }}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <span className="text-[10px] text-[#ccc]">—</span>
            <button
              type="button"
              onClick={() => {
                const el = dateToInputRef.current;
                if (!el) return;
                if (typeof el.showPicker === 'function') el.showPicker();
                else el.click();
              }}
              className="flex h-7 shrink-0 items-center gap-1 rounded-[7px] border border-[#e4e4e4] bg-white px-2 text-[10px] text-[#666]"
            >
              <IconCalendar className="text-[#666]" />
              {formatDateDots(endDate)}
            </button>
            <input
              ref={dateToInputRef}
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setQuickRange(null);
              }}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <button
              type="button"
              onClick={setOneWeek}
              className={cn(
                'h-7 shrink-0 rounded-[7px] border px-2.5 text-[10px]',
                quickRange === 'week' ? 'border-[#111] bg-[#111] text-white' : 'border-[#e4e4e4] bg-white text-[#111]'
              )}
            >
              7 хон
            </button>
            <button
              type="button"
              onClick={setOneMonth}
              className={cn(
                'h-7 shrink-0 rounded-[7px] border px-2.5 text-[10px]',
                quickRange === 'month' ? 'border-[#111] bg-[#111] text-white' : 'border-[#e4e4e4] bg-white text-[#111]'
              )}
            >
              1 сар
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => selectedCount > 0 && handleDeleteSelectedOrders()}
              className={cn(
                'ml-auto h-7 shrink-0 rounded-[7px] border px-2.5 text-[10px]',
                selectedCount === 0
                  ? 'cursor-not-allowed border-[#e0e0e0] text-[#ccc]'
                  : 'border-[#111] font-medium text-[#111]'
              )}
            >
              Устгах ({selectedCount})
            </button>
          </div>
        </header>

        <div className="px-2.5 pt-[9px]">
          <p className="mb-[7px] text-[12px] text-[#888]">{displayedOrders.length} захиалга олдлоо</p>

          {selectedCount > 0 && (
            <div className="mb-1.5 flex h-[34px] w-full items-center justify-between rounded-lg border border-[#e0e0e0] bg-white px-2.5">
              <span className="text-[11px] text-[#555]">{selectedCount} захиалга сонгогдсон</span>
              <button
                type="button"
                disabled={deletingSelected}
                onClick={handleDeleteSelectedOrders}
                className="h-[26px] rounded-md border border-[#ddd] bg-white px-2.5 text-[10px] text-[#888]"
              >
                {deletingSelected ? 'Устгаж…' : `Устгах (${selectedCount})`}
              </button>
            </div>
          )}

          <div className="mb-1.5 flex h-8 w-full items-center gap-2 rounded-lg border border-[#ebebeb] bg-white px-[11px]">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="ochk h-4 w-4 shrink-0 cursor-pointer rounded border border-[#ccc] accent-[#111]"
              checked={allDisplayedSelected}
              onChange={onSelectAllChange}
            />
            <span className="text-[11px] text-[#555]">Бүгдийг сонгох</span>
            <span className="ml-auto text-[10px] text-[#bbb]">{selectAllContextLabel}</span>
          </div>

          {loading && showLoader ? (
            <PageLoader />
          ) : loading ? null : displayedOrders.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[#888]">Захиалга олдсонгүй</div>
          ) : (
            displayedOrders.map((order) => {
              const sel = selectedOrderIds.includes(order._id);
              const { phone, name } = customerDisplay(order);
              const { parts, more } = itemPreviewLine(order);
              return (
                <article
                  key={order._id}
                  className={cn(
                    'mb-1.5 overflow-hidden rounded-[10px] border bg-white transition-colors',
                    sel ? 'border-[#111]' : 'border-[#e8e8e8]'
                  )}
                >
                  <div className="flex items-center gap-2 border-b border-[#f5f5f5] px-[11px] pb-[7px] pt-[9px]">
                    <input
                      type="checkbox"
                      className="ochk h-4 w-4 shrink-0 cursor-pointer rounded border border-[#ccc] accent-[#111]"
                      checked={sel}
                      onChange={() => toggleSelectOrder(order._id)}
                    />
                    <span className="flex-1 text-[13px] font-medium text-[#111]"># {order.orderCode || '—'}</span>
                    <span className="shrink-0 text-[10px] text-[#bbb]">{formatOrderDateTime(order.createdAt)}</span>
                  </div>
                  <div className="px-[11px] pb-2 pt-[7px]">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1">
                        <IconPhone className="shrink-0 text-[#bbb]" />
                        <span className="text-[11px] text-[#666]">{phone}</span>
                        {name ? <span className="text-[10px] text-[#aaa]"> · {name}</span> : null}
                      </div>
                      <span className="shrink-0 text-[14px] font-medium text-[#111]">
                        ₮{(order.total || 0).toLocaleString()}
                      </span>
                    </div>
                    <p className="mb-1.5 text-[10px] leading-[1.5] text-[#aaa]">
                      {parts.join(', ')}
                      {more > 0 ? (
                        <>
                          {' '}
                          <span className="font-medium text-[#555]">+{more} бараа</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center justify-between px-[11px] pb-2 pt-1.5">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                      className="h-[26px] max-w-[52%] cursor-pointer appearance-none rounded-md border border-[#e4e4e4] bg-[#f9f9f9] pl-2 pr-[18px] text-[10px] text-[#555] outline-none"
                      style={{
                        backgroundImage: selectChevronSvg,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 6px center',
                      }}
                    >
                      <option value="pending">Хүлээгдэж буй</option>
                      <option value="processing">Бэлтгэж байна</option>
                      <option value="shipped">Хүргэлтэд гарсан</option>
                      <option value="delivered">Дууссан</option>
                      <option value="cancelled">Цуцлагдсан</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => openDetails(order)}
                      className="flex h-[26px] items-center gap-0.5 rounded-md border border-[#111] bg-white px-[9px] text-[10px] text-[#111]"
                    >
                      <IconInfo className="text-[#111]" />
                      Дэлгэрэнгүй
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>

      <div
        className={cn(
          'fixed inset-0 z-20 flex items-end justify-center transition-opacity duration-200',
          isDetailsOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden={!isDetailsOpen}
      >
        <button
          type="button"
          tabIndex={-1}
          className="absolute inset-0 rounded-[12px] bg-[rgba(0,0,0,0.42)]"
          onClick={closeSheet}
          aria-label="Хаах"
        />
        <div
          className={cn(
            'relative z-[1] flex max-h-[88%] w-full flex-col rounded-t-[14px] bg-white shadow-xl transition-transform duration-200',
            isDetailsOpen ? 'translate-y-0' : 'translate-y-full'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-[5px] mt-2 h-[3px] w-7 shrink-0 rounded-sm bg-[#e0e0e0]" />

          {selectedOrder && (
            <>
              <div className="flex shrink-0 items-start justify-between gap-2 px-[13px] pb-0 pt-1">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#111]">Захиалга #{selectedOrder.orderCode || '—'}</p>
                  <p className="text-[11px] text-[#aaa]">
                    {selectedOrder.user?.name || selectedOrder.customerName || 'Зочин'} ·{' '}
                    {selectedOrder.user?.phoneNumber || selectedOrder.phoneNumber || '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#e8e8e8] bg-[#f7f7f7]"
                  aria-label="Хаах"
                >
                  <IconClose className="text-[#888]" />
                </button>
              </div>

              <div className="mt-2 flex border-b border-[#efefef] px-[13px]">
                <button
                  type="button"
                  className={cn(
                    'flex-1 border-b-2 py-2 text-[11px] transition-colors',
                    !showReceipt ? 'border-[#111] font-medium text-[#111]' : 'border-transparent text-[#aaa]'
                  )}
                  onClick={() => setShowReceipt(false)}
                >
                  Дэлгэрэнгүй
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex-1 border-b-2 py-2 text-[11px] transition-colors',
                    showReceipt ? 'border-[#111] font-medium text-[#111]' : 'border-transparent text-[#aaa]'
                  )}
                  onClick={() => setShowReceipt(true)}
                >
                  Баримт хэвлэх
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {showReceipt ? (
                  <div className="px-[13px] pb-6 pt-2.5">
                    <OrderReceipt order={selectedOrder} />
                  </div>
                ) : (
                  <div className="pb-3">
                    <div className="grid grid-cols-2 px-[13px]">
                      {[
                        ['Захиалгын код', selectedOrder.orderCode || '—'],
                        ['Огноо', new Date(selectedOrder.createdAt).toLocaleString('mn-MN')],
                        ['Төлөв', getStatusLabel(selectedOrder.status)],
                        ['Төлбөр', getPaymentMethodLabel(getOrderPaymentMethod(selectedOrder))],
                        ['Нэр', selectedOrder.user?.name || selectedOrder.customerName || 'Зочин'],
                        ['Утас', selectedOrder.user?.phoneNumber || selectedOrder.phoneNumber || '—'],
                      ].map(([label, val], i) => (
                        <div
                          key={label}
                          className={cn(
                            'border-b border-[#f5f5f5] py-[7px]',
                            i % 2 === 0 ? 'border-r border-[#f5f5f5] pr-2' : 'pl-2'
                          )}
                        >
                          <span className="mb-0.5 block text-[9px] uppercase tracking-[0.3px] text-[#bbb]">{label}</span>
                          <span className="text-[12px] font-medium text-[#111]">{val}</span>
                        </div>
                      ))}
                    </div>

                    <div className="px-[13px] py-1">
                      {(selectedOrder.user?.email || selectedOrder.email) && (
                        <div className="border-b border-[#f5f5f5] py-2">
                          <span className="mb-0.5 block text-[9px] uppercase tracking-[0.3px] text-[#bbb]">Имэйл</span>
                          <span className="text-[11px] text-[#111]">{selectedOrder.user?.email || selectedOrder.email}</span>
                        </div>
                      )}
                      <div className="py-2">
                        <span className="mb-0.5 block text-[9px] uppercase tracking-[0.3px] text-[#bbb]">
                          Хүргэлтийн хаяг
                        </span>
                        <p className="text-[11px] text-[#111]">
                          {getOrderDeliveryAddress(selectedOrder)}
                          {getOrderAddressAdditionalInfo(selectedOrder)
                            ? ` · ${getOrderAddressAdditionalInfo(selectedOrder)}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-[13px] py-2">
                      <div className="h-px flex-1 bg-[#f0f0f0]" />
                      <span className="text-[9px] uppercase tracking-[0.5px] text-[#ccc]">Бараанууд</span>
                      <div className="h-px flex-1 bg-[#f0f0f0]" />
                    </div>

                    {(selectedOrder.items || []).map((item, idx) => {
                      const product = item.product;
                      const mainImg = product?.images?.find((img) => img.isMain) || product?.images?.[0];
                      const lineTotal = (item.price || 0) * (item.quantity || 0);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 border-b border-[#f8f8f8] px-[13px] py-1.5"
                        >
                          <div className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#ebebeb] bg-[#f5f5f5]">
                            {mainImg ? (
                              <Image
                                src={getImageUrl(mainImg.url)}
                                alt={product?.name || ''}
                                fill
                                className="object-cover"
                                unoptimized
                                sizes="34px"
                              />
                            ) : (
                              <IconImagePlaceholder className="text-[#111] opacity-[0.18]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-[#111]">
                              {product?.name || 'Устгагдсан бараа'}
                            </p>
                            <p className="text-[9px] text-[#ccc]">
                              {product?.code ? `${product.code} · ` : ''}x{item.quantity}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[12px] font-medium text-[#111]">₮{lineTotal.toLocaleString()}</p>
                            <p className="text-[9px] text-[#ccc]">
                              ₮{(item.price || 0).toLocaleString()} × {item.quantity}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-between border-t border-[#efefef] bg-[#fafafa] px-[13px] py-[9px]">
                      <span className="text-[12px] font-medium text-[#555]">Нийт дүн</span>
                      <span className="text-[15px] font-medium text-[#111]">
                        ₮{(selectedOrder.total || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="px-[13px] pb-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(selectedOrder._id)}
                        disabled={deletingOrderId === selectedOrder._id}
                        className="h-[34px] w-full rounded-lg border border-[#ddd] bg-white text-[11px] text-[#aaa]"
                      >
                        {deletingOrderId === selectedOrder._id ? 'Устгаж байна...' : 'Энэ захиалгыг устгах'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
