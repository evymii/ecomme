'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/products/ProductCard';
import Loader from '@/components/ui/Loader';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';
import { ChevronRight, Zap, Shield, Truck } from 'lucide-react';

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

  // Get hero image from the first featured product
  const heroProduct = featuredProducts[0] || discountedProducts[0];
  const heroImage = heroProduct?.images?.find(img => img.isMain) || heroProduct?.images?.[0];

  if (initialLoad && loading) {
    return <Loader />;
  }

  const categoryNames = ['Бүгд', ...categories.map(c => c.name)];

  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#5D737E]/10 to-transparent rounded-full border border-[#5D737E]/20">
                <Zap className="w-4 h-4 text-[#5D737E]" />
                <span className="text-sm text-[#5D737E] font-light tracking-wide">Шинэ бүтээгдэхүүн ирлээ</span>
              </div>
              
              <h1 
                className="text-[#02111B] leading-tight tracking-tight"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 600 }}
              >
                Чанартай бараа
                <br />
                <span className="text-[#5D737E]" style={{ fontWeight: 300 }}>таны гарт</span>
              </h1>
              
              <p className="text-[#3F4045] max-w-md font-light leading-relaxed" style={{ fontWeight: 300 }}>
                Бид чанартай, загварлаг бүтээгдэхүүнийг хамгийн тохиромжтой үнээр санал болгож байна.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link 
                  href="/products" 
                  className="px-6 py-3 bg-[#02111B] text-white rounded-full hover:bg-[#3F4045] transition-all duration-300 hover:shadow-xl hover:scale-105 flex items-center gap-2 font-light text-sm"
                >
                  Худалдан авах
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Features */}
              <div className="grid grid-cols-3 gap-4 pt-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#5D737E]/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-[#5D737E]" />
                  </div>
                  <span className="text-xs text-[#3F4045] font-light">Баталгаа</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#30292F]/10 flex items-center justify-center">
                    <Truck className="w-4 h-4 text-[#30292F]" />
                  </div>
                  <span className="text-xs text-[#3F4045] font-light">Хүргэлт</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#02111B]/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#02111B]" />
                  </div>
                  <span className="text-xs text-[#3F4045] font-light">Хурдан</span>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative lg:h-[500px] hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5D737E]/10 via-transparent to-[#02111B]/5 rounded-3xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="absolute w-64 h-64 bg-gradient-to-br from-[#5D737E]/20 to-transparent rounded-full blur-3xl" />
                  {heroImage ? (
                    <div className="relative z-10 w-80 h-80">
                      <Image
                        src={getImageUrl(heroImage.url)}
                        alt="Hero product"
                        fill
                        className="object-contain drop-shadow-2xl"
                        unoptimized
                        priority
                        sizes="320px"
                      />
                    </div>
                  ) : (
                    <div className="relative z-10 w-80 h-80 bg-gradient-to-br from-[#5D737E]/10 to-[#02111B]/5 rounded-3xl flex items-center justify-center">
                      <span className="text-[#5D737E]/30 font-light text-lg">Az</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
            <div className="text-center py-16">
              <p className="text-[#5D737E] font-light text-sm">Ачааллаж байна...</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
