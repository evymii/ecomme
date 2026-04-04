'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/products/ProductCard';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { PageLoader } from '@/components/ui/Loader';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';

interface Product {
  _id: string;
  name: string;
  code?: string;
  price: number;
  images: Array<{ url: string; isMain: boolean }>;
  features: {
    isNew: boolean;
    isFeatured: boolean;
    isDiscounted: boolean;
  };
  category: string;
  stock?: number;
}

interface Category {
  _id: string;
  name: string;
}

const PAGE_LIMIT = 20;

function ProductsContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedBigCategory, setSelectedBigCategory] = useState<string | null>(null);
  const [selectedMiniCategory, setSelectedMiniCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const showLoader = useDelayedLoading(loading, 250);
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoryHierarchy = useCallback((allCategories: Category[]) => {
    const map = new Map<string, { minis: Array<{ label: string; fullName: string }> }>();
    for (const category of allCategories) {
      const rawName = (category.name || '').trim();
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
          .filter((mini, idx, arr) => arr.findIndex((m) => m.fullName === mini.fullName) === idx)
          .sort((a, b) => a.label.localeCompare(b.label, 'mn')),
      }))
      .sort((a, b) => a.big.localeCompare(b.big, 'mn'));
  }, []);

  // Get category from URL
  useEffect(() => {
    const urlBig = searchParams.get('big');
    const urlMini = searchParams.get('mini');
    const categoryId = searchParams.get('category_id');

    if (urlBig) {
      setSelectedBigCategory(urlBig);
      setSelectedMiniCategory(urlMini || null);
      return;
    }

    if (categoryId && categories.length > 0) {
      const categoryDoc = categories.find((category) => category._id === categoryId);
      if (categoryDoc?.name) {
        const [bigRaw, ...rest] = categoryDoc.name.split('/');
        const big = bigRaw.trim();
        const mini = rest.join('/').trim();
        setSelectedBigCategory(big || null);
        setSelectedMiniCategory(mini ? categoryDoc.name : null);
      }
    }
  }, [searchParams, categories]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/categories');
        setCategories(response.data.categories || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, []);

  const hierarchy = categoryHierarchy(categories);
  const selectedHierarchy = selectedBigCategory
    ? hierarchy.find((entry) => entry.big === selectedBigCategory) || null
    : null;
  const selectedCategoryQuery = selectedMiniCategory || selectedBigCategory;

  // Fetch current page only when category or page changes
  useEffect(() => {
    let cancelled = false;

    const fetchProducts = async () => {
      try {
        setLoading(true);

        const url = selectedCategoryQuery
          ? `/products/category/${encodeURIComponent(selectedCategoryQuery)}?page=${page}&limit=${PAGE_LIMIT}`
          : `/products?page=${page}&limit=${PAGE_LIMIT}`;

        const response = await api.get(url);
        const batch: Product[] = response.data.products || [];
        const pagination = response.data.pagination;

        if (!cancelled) {
          setProducts(batch);
          setTotal(pagination?.total || 0);
          setHasMore(Boolean(pagination?.hasMore));
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        if (!cancelled) {
          setProducts([]);
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryQuery, page]);

  const handleBigCategoryClick = (bigCategory: string | null) => {
    setSelectedBigCategory(bigCategory);
    setSelectedMiniCategory(null);
    setPage(1);
    if (bigCategory) {
      router.push(`/products?big=${encodeURIComponent(bigCategory)}`);
    } else {
      router.push('/products');
    }
  };

  const handleMiniCategoryClick = (miniCategory: string | null) => {
    setSelectedMiniCategory(miniCategory);
    setPage(1);
    if (!selectedBigCategory) return;
    if (miniCategory) {
      router.push(
        `/products?big=${encodeURIComponent(selectedBigCategory)}&mini=${encodeURIComponent(miniCategory)}`
      );
    } else {
      router.push(`/products?big=${encodeURIComponent(selectedBigCategory)}`);
    }
  };

  // Get current category name for display
  const selectedCategoryName = selectedMiniCategory || selectedBigCategory || 'Бүх бүтээгдэхүүн';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      {/* Page Title */}
      <div className="mb-6 md:mb-8">
        <h1
          className="text-2xl md:text-3xl text-[#02111B] tracking-tight mb-2"
          style={{ fontWeight: 600 }}
        >
          {selectedCategoryName}
        </h1>
        <p className="text-sm text-[#5D737E] font-light">
          {total > 0 ? `${total} бүтээгдэхүүн` : ''}
        </p>
      </div>

      {/* Main Categories — single horizontal row, scroll */}
      <div className="flex flex-nowrap gap-2.5 overflow-x-auto pb-4 mb-6 md:mb-8 scrollbar-hide min-w-0">
        <button
          type="button"
          onClick={() => handleBigCategoryClick(null)}
          className={cn(
            'flex h-[38px] px-3 md:h-[56px] md:px-4 shrink-0 items-center justify-center rounded-2xl border text-xs md:text-sm font-light tracking-wide transition-all duration-300 min-w-fit',
            selectedBigCategory === null
              ? 'bg-[#02111B] text-white shadow-lg scale-105 border-transparent'
              : 'bg-white text-[#5D737E] border-[#02111B]/10 hover:border-[#5D737E]/30'
          )}
        >
          <span className="line-clamp-2 text-center leading-tight [word-break:break-word]">
            Бүгд
          </span>
        </button>
        {hierarchy.map((entry) => (
          <button
            type="button"
            key={entry.big}
            onClick={() => handleBigCategoryClick(entry.big)}
            className={cn(
              'flex h-[38px] px-3 md:h-[56px] md:px-4 shrink-0 items-center justify-center rounded-2xl border text-xs md:text-sm font-light tracking-wide transition-all duration-300 min-w-fit',
              selectedBigCategory === entry.big
                ? 'bg-[#02111B] text-white shadow-lg scale-105 border-transparent'
                : 'bg-white text-[#5D737E] border-[#02111B]/10 hover:border-[#5D737E]/30'
            )}
          >
            <span className="line-clamp-2 text-center leading-tight [word-break:break-word]">{entry.big}</span>
          </button>
        ))}
      </div>

      {selectedHierarchy && selectedHierarchy.minis.length > 0 && (
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-3 mb-6 -mt-4 md:-mt-5 scrollbar-hide min-w-0">
          <button
            type="button"
            onClick={() => handleMiniCategoryClick(null)}
            className={cn(
              'flex h-[31px] px-2.5 md:h-[46px] md:px-3 shrink-0 items-center justify-center rounded-xl border text-[10px] md:text-xs font-light leading-tight transition-colors min-w-fit',
              selectedMiniCategory === null
                ? 'bg-[#02111B] text-white border-[#02111B]'
                : 'bg-white text-[#5D737E] border-[#02111B]/15 hover:border-[#5D737E]/30'
            )}
          >
            <span className="line-clamp-2 text-center leading-snug [word-break:break-word]">Бүгд</span>
          </button>
          {selectedHierarchy.minis.map((mini) => (
            <button
              type="button"
              key={mini.fullName}
              onClick={() => handleMiniCategoryClick(mini.fullName)}
              className={cn(
                'flex h-[31px] px-2.5 md:h-[46px] md:px-3 shrink-0 items-center justify-center rounded-xl border text-[10px] md:text-xs font-light leading-tight transition-colors min-w-fit',
                selectedMiniCategory === mini.fullName
                  ? 'bg-[#02111B] text-white border-[#02111B]'
                  : 'bg-white text-[#5D737E] border-[#02111B]/15 hover:border-[#5D737E]/30'
              )}
            >
              <span className="line-clamp-2 text-center leading-snug [word-break:break-word]">{mini.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {loading && showLoader ? (
        <PageLoader />
      ) : loading ? null : products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#5D737E] font-light">Бараа олдсонгүй</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
            {products.map((product, index) => (
              <ProductCard key={product._id} product={product} priority={index < 4} />
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="mt-8 md:mt-12 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm border border-[#02111B]/20 text-[#02111B] rounded-full hover:border-[#5D737E]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-light"
            >
              ← Өмнөх
            </button>
            <span className="text-sm text-[#5D737E] font-light">
              {page} хуудас
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!hasMore}
              className="px-4 py-2 text-sm border border-[#02111B]/20 text-[#02111B] rounded-full hover:border-[#5D737E]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-light"
            >
              Дараах →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductsPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  // Redirect admin users to admin pages
  const userRole = user?.role;
  useEffect(() => {
    if (userRole === 'admin') {
      router.push('/admin/orders');
    }
  }, [userRole, router]);

  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PageLoader />
          </div>
        }>
          <ProductsContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
