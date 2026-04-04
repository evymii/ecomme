'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/components/layout/Header';
import { Input } from '@/components/ui/input';
import ProductModal from '@/components/admin/ProductModal';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';
import Loader from '@/components/ui/Loader';
import { PageLoader, ListItemSkeleton } from '@/components/ui/Loader';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { getCache, setCache, clearCache } from '@/lib/admin-cache';
import { cn } from '@/lib/utils';

interface ProductImage {
  url: string;
  isMain: boolean;
  order?: number;
}

interface Product {
  _id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  images: ProductImage[];
  features: {
    isNew: boolean;
    isFeatured: boolean;
    isDiscounted: boolean;
  };
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline
        points="3 6 5 6 21 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCloseSmall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconImagePlaceholder({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const PAGE_LIMIT = 20;

interface AdminCategoryRow {
  name?: string;
  fullName?: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoriesForFilter, setCategoriesForFilter] = useState<AdminCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoader = useDelayedLoading(loading, 250);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const productModalTriggerRef = useRef<HTMLElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBigCategory, setSelectedBigCategory] = useState<string | null>(null);
  const [selectedMiniCategory, setSelectedMiniCategory] = useState<string | null>(null);
  const { isAdmin, isChecking } = useAdminAuth();
  const { toast } = useToast();

  const handleAdminAuthError = useCallback(
    async (error: any) => {
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        return false;
      }
      try {
        const check = await api.get('/admin/check', { timeout: 8000 });
        if (check.data?.success && check.data?.isAdmin) {
          return true;
        }
      } catch (_checkError) {
        // ignore
      }
      toast({
        title: 'Анхааруулга',
        description: 'Энэ үйлдэлд нэвтрэх эрх хүрэлцэхгүй байна.',
        variant: 'destructive',
      });
      return true;
    },
    [toast]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          product.name.toLowerCase().includes(query) ||
          product.code.toLowerCase().includes(query)
        );
      }),
    [products, searchQuery]
  );

  const categoryHierarchy = useMemo(() => {
    const map = new Map<
      string,
      { minis: Array<{ label: string; fullName: string }> }
    >();
    for (const cat of categoriesForFilter) {
      const rawName = (cat.fullName || cat.name || '').trim();
      if (!rawName) continue;
      const [bigRaw, ...rest] = rawName.split('/');
      const big = bigRaw.trim();
      if (!big) continue;
      const miniLabel = rest.join('/').trim();
      const entry = map.get(big) || { minis: [] };
      if (miniLabel) {
        entry.minis.push({ label: miniLabel, fullName: rawName });
      }
      map.set(big, entry);
    }
    return Array.from(map.entries())
      .map(([big, data]) => ({
        big,
        minis: data.minis
          .filter(
            (mini, idx, arr) =>
              arr.findIndex((m) => m.fullName === mini.fullName) === idx
          )
          .sort((a, b) => a.label.localeCompare(b.label, 'mn')),
      }))
      .sort((a, b) => a.big.localeCompare(b.big, 'mn'));
  }, [categoriesForFilter]);

  const selectedHierarchy = useMemo(() => {
    if (!selectedBigCategory) return null;
    return (
      categoryHierarchy.find((entry) => entry.big === selectedBigCategory) ??
      null
    );
  }, [categoryHierarchy, selectedBigCategory]);

  const categoryFilteredProducts = useMemo(() => {
    let base = filteredProducts;
    if (selectedBigCategory === null) {
      // all
    } else if (selectedMiniCategory) {
      base = base.filter(
        (product) =>
          (product.category?.trim() || 'Бусад ангилал') === selectedMiniCategory
      );
    } else {
      const big = selectedBigCategory;
      base = base.filter((product) => {
        const c = product.category?.trim() || 'Бусад ангилал';
        return c === big || c.startsWith(`${big}/`);
      });
    }
    return [...base].sort((a, b) => a.name.localeCompare(b.name, 'mn'));
  }, [filteredProducts, selectedBigCategory, selectedMiniCategory]);

  const CACHE_KEY = 'admin_products';

  const normalizeProducts = (raw: any[]): Product[] =>
    raw.map((product: any) => ({
      ...product,
      images: (product.images || []).map((img: any, index: number) => ({
        url: img.url,
        isMain: img.isMain || false,
        order: img.order !== undefined ? img.order : index,
      })),
    }));

  const fetchProducts = useCallback(
    async (opts?: { skipCache?: boolean }) => {
      const skipCache = opts?.skipCache ?? false;
      if (!skipCache) {
        const cached = getCache<{
          products: Product[];
          total: number;
          totalPages: number;
          page: number;
        }>(`${CACHE_KEY}_p${page}`, 30_000);
        if (cached && cached.page === page) {
          setProducts(cached.products);
          setTotal(cached.total);
          setTotalPages(cached.totalPages);
          setLoading(false);
          api
            .get('/admin/products', {
              params: { page, limit: PAGE_LIMIT },
              timeout: 25000,
            })
            .then((res) => {
              if (res.data?.success) {
                const normalized = normalizeProducts(res.data.products || []);
                const t = res.data.total ?? 0;
                const tp = res.data.totalPages ?? 1;
                setProducts(normalized);
                setTotal(t);
                setTotalPages(tp);
                setCache(`${CACHE_KEY}_p${page}`, {
                  products: normalized,
                  total: t,
                  totalPages: tp,
                  page,
                });
              }
            })
            .catch(() => {});
          return;
        }
      }

      try {
        setLoading(true);
        const response = await api.get('/admin/products', {
          params: { page, limit: PAGE_LIMIT },
          timeout: 25000,
        });
        if (!response.data?.success) {
          toast({
            title: 'Алдаа',
            description: response.data?.message || 'Бараанууд авахад алдаа гарлаа',
            variant: 'destructive',
          });
          return;
        }
        const normalized = normalizeProducts(response.data.products || []);
        const t = response.data.total ?? 0;
        const tp = response.data.totalPages ?? 1;
        if (normalized.length === 0 && page > 1 && t > 0) {
          setPage((p) => Math.max(1, p - 1));
          return;
        }
        setProducts(normalized);
        setTotal(t);
        setTotalPages(tp);
        setCache(`${CACHE_KEY}_p${page}`, {
          products: normalized,
          total: t,
          totalPages: tp,
          page,
        });
      } catch (error: any) {
        console.error('Error fetching products:', error);
        if (await handleAdminAuthError(error)) {
          return;
        }
        toast({
          title: 'Алдаа',
          description:
            error.response?.data?.message || 'Бараанууд авахад алдаа гарлаа',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [page, toast, handleAdminAuthError]
  );

  useEffect(() => {
    if (!isAdmin || isChecking) return;
    api
      .get('/admin/categories')
      .then((res) => {
        if (res.data?.success) {
          setCategoriesForFilter(res.data.categories || []);
        }
      })
      .catch(() => {});
  }, [isAdmin, isChecking]);

  useEffect(() => {
    if (isAdmin && !isChecking) {
      void fetchProducts();
    }
  }, [isAdmin, isChecking, page, fetchProducts]);

  const handleEdit = async (product: Product, triggerEl?: HTMLElement | null) => {
    productModalTriggerRef.current = triggerEl ?? null;
    setEditLoading(true);
    try {
      const response = await api.get(`/products/${product._id}`);
      const fullProduct = response.data?.product;
      if (!response.data?.success || !fullProduct) {
        toast({
          title: 'Алдаа',
          description:
            response.data?.message || 'Барааны дэлгэрэнгүй мэдээлэл авахад алдаа гарлаа',
          variant: 'destructive',
        });
        return;
      }
      setEditingProduct(fullProduct);
      setModalOpen(true);
    } catch (error: any) {
      if (await handleAdminAuthError(error)) {
        return;
      }
      toast({
        title: 'Алдаа',
        description:
          error.response?.data?.message ||
          'Барааны дэлгэрэнгүй мэдээлэл авахад алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm('Энэ барааг устгахдаа итгэлтэй байна уу?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      setProducts((prev) => prev.filter((product) => product._id !== id));
      toast({
        title: 'Амжилттай',
        description: `"${name}" бараа устгагдлаа`,
      });
      clearCache(`${CACHE_KEY}_p${page}`);
      void fetchProducts({ skipCache: true });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      if (await handleAdminAuthError(error)) {
        return;
      }
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Бараа устгахад алдаа гарлаа',
        variant: 'destructive',
      });
    }
  };

  if (isChecking) {
    return <Loader />;
  }

  if (!isAdmin) {
    return null;
  }

  const pillActive = 'border border-[#111] bg-[#111] text-white';
  const pillInactive = 'border border-[#e4e4e4] bg-white text-[#111]';
  const paginationBtn =
    'h-8 min-w-[100px] rounded-[7px] border border-[#e4e4e4] bg-white px-3 text-[11px] text-[#111] disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="sticky top-0 z-10 border-b border-[#efefef] bg-white px-[10px] md:px-6 lg:px-8 pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[16px] font-medium leading-tight text-[#111]">
              Барааны удирдлага
            </h1>
            <p className="mt-0.5 text-[11px] leading-snug text-[#888]">
              Дэлгүүрийн бүх барааг удирдах
            </p>
          </div>
          {!loading && (
            <span className="shrink-0 rounded-[20px] border border-[#e8e8e8] bg-[#f5f5f5] px-2 py-0.5 text-[11px] leading-none text-[#111]">
              {total} бараа
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-[7px]">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-[#888]" />
            <Input
              type="text"
              placeholder="Хайх..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#e4e4e4] bg-white pl-8 pr-7 text-[13px] text-[#111] placeholder:text-[#bbb] focus-visible:ring-1 focus-visible:ring-[#ccc]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#888] hover:bg-[#f5f5f5]"
                aria-label="Цэвэрлэх"
              >
                <IconCloseSmall className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              productModalTriggerRef.current = e.currentTarget;
              setEditingProduct(null);
              setModalOpen(true);
            }}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[#111] px-3 text-[12px] font-medium text-white"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Нэмэх
          </button>
        </div>

        <div className="mt-2 flex flex-col gap-[5px]">
          <div className="scrollbar-hide flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => {
                setSelectedBigCategory(null);
                setSelectedMiniCategory(null);
              }}
              className={cn(
                'inline-flex h-[27px] shrink-0 items-center whitespace-nowrap rounded-[14px] px-[11px] text-[11px] font-medium leading-none',
                selectedBigCategory === null ? pillActive : pillInactive
              )}
            >
              Бүгд
            </button>
            {categoryHierarchy.map((entry) => (
              <button
                type="button"
                key={entry.big}
                onClick={() => {
                  setSelectedBigCategory(entry.big);
                  setSelectedMiniCategory(null);
                }}
                className={cn(
                  'inline-flex h-[27px] shrink-0 items-center whitespace-nowrap rounded-[14px] px-[11px] text-[11px] font-medium leading-none',
                  selectedBigCategory === entry.big ? pillActive : pillInactive
                )}
              >
                {entry.big}
              </button>
            ))}
          </div>

          {selectedHierarchy && selectedHierarchy.minis.length > 0 ? (
            <div className="scrollbar-hide flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedMiniCategory(null)}
                className={cn(
                  'inline-flex h-[27px] shrink-0 items-center whitespace-nowrap rounded-[7px] px-[11px] text-[11px] font-medium leading-none',
                  selectedMiniCategory === null ? pillActive : pillInactive
                )}
              >
                Бүгд
              </button>
              {selectedHierarchy.minis.map((mini) => (
                <button
                  type="button"
                  key={mini.fullName}
                  onClick={() => setSelectedMiniCategory(mini.fullName)}
                  className={cn(
                    'inline-flex h-[27px] shrink-0 items-center whitespace-nowrap rounded-[7px] px-[11px] text-[11px] font-medium leading-none',
                    selectedMiniCategory === mini.fullName
                      ? pillActive
                      : pillInactive
                  )}
                >
                  {mini.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-lg md:max-w-6xl lg:max-w-7xl bg-white px-[10px] md:px-6 lg:px-8 py-[10px]">
        {loading && showLoader ? (
          <div className="pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : loading ? null : categoryFilteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 text-5xl opacity-30">📦</div>
            <p className="text-[15px] font-medium text-[#111] mb-1">Илэрцтэй бараа олдсонгүй</p>
            <p className="text-[13px] text-[#888]">Хайлт эсвэл ангилал сонгоно уу</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6 md:gap-6">
            {categoryFilteredProducts.map((product) => {
              const mainImage =
                product.images.find((img) => img.isMain) || product.images[0];
              return (
                <div
                  key={product._id}
                  className="flex flex-col overflow-hidden rounded-[10px] border border-[#ebebeb] bg-white"
                >
                  <div className="relative aspect-square w-full bg-[#f5f5f5]">
                    {mainImage ? (
                      <Image
                        src={getImageUrl(mainImage.url)}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <IconImagePlaceholder className="h-10 w-10 text-[#c8c8c8]" />
                      </div>
                    )}
                    {product.features.isNew && (
                      <span className="absolute left-1 top-1 rounded bg-[#111] px-1 py-px text-[9px] text-white">
                        Шинэ
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-[9px] pb-2 pt-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[10px] leading-tight text-[#c0c0c0]">
                        Код: {product.code}
                      </p>
                      <h3 className="line-clamp-2 text-[12px] font-medium leading-[1.3] text-[#111]">
                        {product.name}
                      </h3>
                      <p className="line-clamp-1 text-[10px] leading-tight text-[#c8c8c8]">
                        {product.category}
                      </p>
                      <p className="text-[13px] font-medium leading-tight text-[#111]">
                        ₮{product.price.toLocaleString()}
                      </p>
                      <p className="text-[10px] leading-tight text-[#c8c8c8]">
                        Нөөц: {product.stock} ширхэг
                      </p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-[5px]">
                      <button
                        type="button"
                        disabled={editLoading}
                        onClick={(e) => void handleEdit(product, e.currentTarget)}
                        className="flex h-7 items-center justify-center gap-1 rounded-[7px] border border-[#e4e4e4] bg-white text-[11px] text-[#444]"
                      >
                        <IconEdit className="h-[10px] w-[10px]" />
                        Засах
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product._id, product.name)}
                        className="flex h-7 items-center justify-center gap-1 rounded-[7px] border border-[#e4e4e4] bg-white text-[11px] text-[#999]"
                      >
                        <IconTrash className="h-[10px] w-[10px]" />
                        Устгах
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
            {total > 0 ? (
              <div className="mt-4 flex items-center justify-center gap-4">
                <button
                  type="button"
                  className={paginationBtn}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Өмнөх
                </button>
                <span className="text-[12px] text-[#888]">
                  {page} / {totalPages} хуудас
                </span>
                <button
                  type="button"
                  className={paginationBtn}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Дараах →
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>

      <ProductModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        product={editingProduct}
        returnFocusRef={productModalTriggerRef}
        onSuccess={() => {
          clearCache(`${CACHE_KEY}_p${page}`);
          void fetchProducts({ skipCache: true });
        }}
      />
    </div>
  );
}
