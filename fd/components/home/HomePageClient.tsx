'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/products/ProductCard';
import { PageLoader } from '@/components/ui/Loader';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Zap, Shield, Package } from 'lucide-react';
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
  stock?: number;
  category?: string;
}

interface Category {
  _id: string;
  name: string;
}

interface HomePageClientProps {
  initialData: {
    featuredProducts: Product[];
    discountedProducts: Product[];
    allProducts: Product[];
    allProductsPagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
    categories: Category[];
  };
}

export default function HomePageClient({ initialData }: HomePageClientProps) {
  const [featuredProducts] = useState<Product[]>(initialData.featuredProducts || []);
  const [discountedProducts] = useState<Product[]>(initialData.discountedProducts || []);
  const [allProducts, setAllProducts] = useState<Product[]>(initialData.allProducts || []);
  const [categories] = useState<Category[]>(initialData.categories || []);
  const [selectedCategory, setSelectedCategory] = useState<string>('Бүгд');
  const [currentPage, setCurrentPage] = useState<number>(initialData.allProductsPagination?.page || 1);
  const [hasMoreProducts, setHasMoreProducts] = useState<boolean>(initialData.allProductsPagination?.hasMore || false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const showLoader = useDelayedLoading(loading, 250);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

  // Redirect admin users to admin pages
  const userRole = user?.role;
  useEffect(() => {
    if (userRole === 'admin') {
      router.push('/admin/orders');
    }
  }, [userRole, router]);

  const handleCategoryFilter = async (categoryName: string) => {
    setSelectedCategory(categoryName);
    if (categoryName === 'Бүгд') {
      setAllProducts(initialData.allProducts || []);
      setCurrentPage(initialData.allProductsPagination?.page || 1);
      setHasMoreProducts(initialData.allProductsPagination?.hasMore || false);
      return;
    }

    const category = categories.find((c) => c.name === categoryName);
    if (!category) return;

    try {
      setLoading(true);
      const response = await api.get(`/products/category/${category._id}?page=1&limit=100`);
      setAllProducts(response.data.products || []);
      setCurrentPage(1);
      setHasMoreProducts(false);
    } catch (error) {
      console.error('Error fetching category products:', error);
      setAllProducts([]);
      setCurrentPage(1);
      setHasMoreProducts(false);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreProducts = async () => {
    if (selectedCategory !== 'Бүгд') return;
    if (loadingMore || !hasMoreProducts) return;
    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      const response = await api.get(`/products?page=${nextPage}&limit=12`);
      const nextProducts = response.data?.products || [];
      const hasMore = !!response.data?.pagination?.hasMore;
      setAllProducts((prev) => {
        const seen = new Set(prev.map((p) => p._id));
        const merged = [...prev];
        for (const product of nextProducts) {
          if (!seen.has(product._id)) {
            merged.push(product);
          }
        }
        return merged;
      });
      setCurrentPage(nextPage);
      setHasMoreProducts(hasMore);
    } catch (error) {
      console.error('Error loading more products:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (selectedCategory !== 'Бүгд') return;
    if (!hasMoreProducts) return;
    const target = loadMoreTriggerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          loadMoreProducts();
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [selectedCategory, hasMoreProducts, currentPage, loadingMore]);

  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);

  useEffect(() => {
    if (categories.length === 0) return;
    const interval = setInterval(() => {
      setActiveCategoryIndex((prev) => (prev + 1) % categories.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [categories.length]);

  const rotatingCategoryWidthStyle = useMemo(() => {
    const longestCategoryLength = categories.reduce((max, cat) => Math.max(max, cat.name.length), 0);
    // +6 for icon/padding so long names don't get clipped in the animated badge on desktop.
    const widthInCh = Math.max(12, Math.min(34, longestCategoryLength + 6));
    return {
      ['--rotating-width' as string]: `${widthInCh}ch`,
    } as const;
  }, [categories]);

  const categoryNames = ['Бүгд', ...categories.map((c) => c.name)];

  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      <Header />

      <section className="border-b border-[#02111B]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3">
            <div className="inline-flex w-full sm:w-auto justify-center sm:justify-start items-center gap-2 px-4 py-2 bg-[#02111B]/5 rounded-full">
              <Zap className="w-3.5 h-3.5 text-[#02111B]" />
              <span className="text-sm text-[#02111B] font-medium tracking-tight whitespace-nowrap text-center sm:text-left">
                Шинэ бүтээгдэхүүн ирлээ
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#3F4045]" />
                <span className="text-sm text-[#3F4045] font-light whitespace-nowrap">Баталгаа</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#3F4045]" />
                <span className="text-sm text-[#3F4045] font-light whitespace-nowrap">Хүргэлт</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#3F4045]" />
                <span className="text-sm text-[#3F4045] font-light whitespace-nowrap">Хурдан</span>
              </div>
            </div>

            {categories.length > 0 ? (
              <div
                className="relative h-10 overflow-hidden w-full sm:w-[var(--rotating-width)] sm:max-w-[34ch] sm:flex-shrink-0"
                style={rotatingCategoryWidthStyle}
              >
                {categories.map((cat, i) => (
                  <div
                    key={cat._id}
                    className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out"
                    style={{
                      opacity: activeCategoryIndex === i ? 1 : 0,
                      transform:
                        activeCategoryIndex === i
                          ? 'translateY(0)'
                          : activeCategoryIndex > i || (activeCategoryIndex === 0 && i === categories.length - 1 && i !== 0)
                            ? 'translateY(-100%)'
                            : 'translateY(100%)',
                    }}
                  >
                    <button
                      onClick={() => handleCategoryFilter(cat.name)}
                      className="inline-flex w-full h-10 items-center justify-center gap-2 px-4 border border-[#02111B]/10 rounded-full hover:bg-[#02111B]/5 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#02111B] flex-shrink-0" />
                      <span className="text-sm text-[#02111B] font-medium tracking-tight whitespace-nowrap truncate max-w-full">
                        {cat.name}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-32" />
            )}
          </div>
        </div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="border-t border-[#02111B]/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl text-[#02111B] tracking-tight" style={{ fontWeight: 600 }}>Онцлох бараа</h2>
              <Link href="/products?featured=true" className="text-sm text-[#5D737E] hover:text-[#02111B] transition-colors font-light flex items-center gap-1">
                Бүгдийг үзэх
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {featuredProducts.slice(0, 8).map((product, index) => (
                <ProductCard key={product._id} product={product} priority={index < 4} categoryName="Онцлох" />
              ))}
            </div>
          </div>
        </section>
      )}

      {discountedProducts.length > 0 && (
        <section className="border-t border-[#02111B]/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl text-[#02111B] tracking-tight" style={{ fontWeight: 600 }}>Хямдарсан бараа</h2>
              <Link href="/products?discounted=true" className="text-sm text-[#5D737E] hover:text-[#02111B] transition-colors font-light flex items-center gap-1">
                Бүгдийг үзэх
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {discountedProducts.slice(0, 8).map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-[#02111B]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categoryNames.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryFilter(category)}
                className={`px-5 py-2 rounded-full whitespace-nowrap transition-all duration-300 font-light tracking-wide text-sm ${
                  selectedCategory === category
                    ? 'bg-[#02111B] text-white shadow-lg scale-105'
                    : 'bg-white text-[#5D737E] border border-[#02111B]/10 hover:border-[#5D737E]/30 hover:bg-white'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {allProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                {allProducts.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
              {selectedCategory === 'Бүгд' && (
                <div ref={loadMoreTriggerRef} className="h-10 mt-6 flex items-center justify-center">
                  {loadingMore ? (
                    <span className="text-sm text-[#5D737E] font-light">Илүү бүтээгдэхүүн ачаалж байна...</span>
                  ) : hasMoreProducts ? (
                    <span className="text-xs text-[#5D737E] font-light">Доош гүйлгэж үргэлжлүүлэн ачаална</span>
                  ) : null}
                </div>
              )}
            </>
          ) : loading ? (
            showLoader ? <PageLoader /> : null
          ) : (
            <div className="text-center py-16">
              <p className="text-[#5D737E] font-light">Бараа олдсонгүй</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
