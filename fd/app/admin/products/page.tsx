'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import { Input } from '@/components/ui/input';
import ProductModal from '@/components/admin/ProductModal';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';
import Loader from '@/components/ui/Loader';
import { PageLoader } from '@/components/ui/Loader';
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

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoader = useDelayedLoading(loading, 250);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
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
    for (const product of products) {
      const rawName = (product.category || '').trim();
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
  }, [products]);

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
    async (skipCache = false) => {
      if (!skipCache) {
        const cached = getCache<Product[]>(CACHE_KEY, 60_000);
        if (cached) {
          setProducts(cached);
          setLoading(false);
          api
            .get('/admin/products', { timeout: 25000 })
            .then((res) => {
              if (res.data?.success) {
                const normalized = normalizeProducts(res.data.products || []);
                setProducts(normalized);
                setCache(CACHE_KEY, normalized);
              }
            })
            .catch(() => {});
          return;
        }
      }

      try {
        const response = await api.get('/admin/products', { timeout: 25000 });
        if (!response.data?.success) {
          toast({
            title: 'Алдаа',
            description: response.data?.message || 'Бараанууд авахад алдаа гарлаа',
            variant: 'destructive',
          });
          return;
        }
        const normalized = normalizeProducts(response.data.products || []);
        setProducts(normalized);
        setCache(CACHE_KEY, normalized);
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
    [toast, handleAdminAuthError]
  );

  useEffect(() => {
    if (isAdmin && !isChecking) {
      fetchProducts();
    }
  }, [isAdmin, isChecking, fetchProducts]);

  const handleEdit = (product: Product) => {
    const openEditModal = async () => {
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
      }
    };
    openEditModal();
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
      clearCache(CACHE_KEY);
      void fetchProducts(true);
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

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="sticky top-0 z-10 border-b border-[#efefef] bg-white px-[10px] pb-2 pt-3">
        <h1 className="text-[16px] font-medium leading-tight text-[#111]">
          Барааны удирдлага
        </h1>
        <p className="mt-0.5 text-[11px] leading-snug text-[#888]">
          Дэлгүүрийн бүх барааг удирдах
        </p>

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
            onClick={() => {
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

      <main className="bg-white px-[10px] py-[10px]">
        {loading && showLoader ? (
          <PageLoader />
        ) : loading ? null : categoryFilteredProducts.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-[#888]">
            Илэрцтэй бараа олдсонгүй
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
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
                        onClick={() => handleEdit(product)}
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
        )}
      </main>

      <ProductModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        product={editingProduct}
        onSuccess={() => {
          clearCache(CACHE_KEY);
          fetchProducts(true);
        }}
      />
    </div>
  );
}
