'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/products/ProductCard';
import Loader from '@/components/ui/Loader';
import { PageLoader } from '@/components/ui/Loader';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Zap, Shield, Package } from 'lucide-react';

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

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [discountedProducts, setDiscountedProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Бүгд');
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  // Redirect admin users to admin pages
  const userRole = user?.role;
  useEffect(() => {
    if (userRole === 'admin') {
      router.push('/admin/orders');
    }
  }, [userRole, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [featuredRes, discountedRes, productsRes, categoriesRes] = await Promise.all([
          api.get('/products/featured').catch(() => ({ data: { products: [] } })),
          api.get('/products/discounted').catch(() => ({ data: { products: [] } })),
          api.get('/products').catch(() => ({ data: { products: [] } })),
          api.get('/categories').catch(() => ({ data: { categories: [] } })),
        ]);

        setFeaturedProducts(featuredRes.data.products || []);
        setDiscountedProducts(discountedRes.data.products || []);
        setAllProducts(productsRes.data.products || []);
        setCategories(categoriesRes.data.categories || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
        // Small delay for loader animation
        setTimeout(() => setInitialLoad(false), 800);
      }
    };

    fetchData();
  }, []);

  // Handle category filter
  const handleCategoryFilter = async (categoryName: string) => {
    setSelectedCategory(categoryName);
    if (categoryName === 'Бүгд') {
      try {
        const response = await api.get('/products');
        setAllProducts(response.data.products || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    } else {
      const category = categories.find(c => c.name === categoryName);
      if (category) {
        try {
          const response = await api.get(`/products/category/${category._id}`);
          setAllProducts(response.data.products || []);
        } catch (error) {
          console.error('Error fetching category products:', error);
        }
      }
    }
  };

  // Rotating category index for hero bar
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);

  useEffect(() => {
    if (categories.length === 0) return;
    const interval = setInterval(() => {
      setActiveCategoryIndex((prev) => (prev + 1) % categories.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [categories.length]);

  if (initialLoad && loading) {
    return <Loader />;
  }

  const categoryNames = ['Бүгд', ...categories.map(c => c.name)];

  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      <Header />

      {/* Hero Bar - compact single row */}
      <section className="border-b border-[#02111B]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            {/* Left: New arrival badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#02111B]/5 rounded-full flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-[#02111B]" />
              <span className="text-sm text-[#02111B] font-medium tracking-tight whitespace-nowrap">Шинэ бүтээгдэхүүн ирлээ</span>
            </div>

            {/* Center: Features */}
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

            {/* Right: Rotating category badge */}
            {categories.length > 0 ? (
              <div className="relative flex-shrink-0 h-9 w-28 sm:w-32 overflow-hidden">
                {categories.map((cat, i) => (
                  <div
                    key={cat._id}
                    className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out"
                    style={{
                      opacity: activeCategoryIndex === i ? 1 : 0,
                      transform: activeCategoryIndex === i 
                        ? 'translateY(0)' 
                        : activeCategoryIndex > i || (activeCategoryIndex === 0 && i === categories.length - 1 && i !== 0)
                          ? 'translateY(-100%)' 
                          : 'translateY(100%)',
                    }}
                  >
                    <button
                      onClick={() => handleCategoryFilter(cat.name)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-[#02111B]/10 rounded-full hover:bg-[#02111B]/5 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#02111B]" />
                      <span className="text-sm text-[#02111B] font-medium tracking-tight whitespace-nowrap">{cat.name}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-28 sm:w-32" />
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="border-t border-[#02111B]/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl text-[#02111B] tracking-tight" style={{ fontWeight: 600 }}>
                Онцлох бараа
              </h2>
              <Link 
                href="/products?featured=true" 
                className="text-sm text-[#5D737E] hover:text-[#02111B] transition-colors font-light flex items-center gap-1"
              >
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

      {/* Discounted Products */}
      {discountedProducts.length > 0 && (
        <section className="border-t border-[#02111B]/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl text-[#02111B] tracking-tight" style={{ fontWeight: 600 }}>
                Хямдарсан бараа
              </h2>
              <Link 
                href="/products?discounted=true" 
                className="text-sm text-[#5D737E] hover:text-[#02111B] transition-colors font-light flex items-center gap-1"
              >
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

      {/* Categories Filter + All Products */}
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

      {/* Products Grid */}
      <section className="pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {allProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {allProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : !loading ? (
            <div className="text-center py-16">
              <p className="text-[#5D737E] font-light">Бараа олдсонгүй</p>
            </div>
          ) : (
            <PageLoader />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
