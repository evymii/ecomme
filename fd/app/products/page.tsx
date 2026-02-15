'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/products/ProductCard';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

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

function ProductsContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get category from URL
  useEffect(() => {
    const categoryId = searchParams.get('category_id');
    if (categoryId) {
      setSelectedCategoryId(categoryId);
    }
  }, [searchParams]);

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

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        let response;
        if (selectedCategoryId) {
          response = await api.get(`/products/category/${selectedCategoryId}`);
        } else {
          response = await api.get('/products');
        }
        setProducts(response.data.products || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategoryId]);

  const handleCategoryClick = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    if (categoryId) {
      router.push(`/products?category_id=${categoryId}`);
    } else {
      router.push('/products');
    }
  };

  // Get current category name for display
  const selectedCategoryName = selectedCategoryId 
    ? categories.find(c => c._id === selectedCategoryId)?.name || 'Бүтээгдэхүүн'
    : 'Бүх бүтээгдэхүүн';

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
          {products.length > 0 ? `${products.length} бүтээгдэхүүн` : ''}
        </p>
      </div>

      {/* Category Filters - Horizontal Pills */}
      <div className="flex gap-2.5 overflow-x-auto pb-4 mb-6 md:mb-8 scrollbar-hide">
        <button
          onClick={() => handleCategoryClick(null)}
          className={cn(
            'px-5 py-2 rounded-full whitespace-nowrap transition-all duration-300 text-sm font-light tracking-wide',
            selectedCategoryId === null
              ? 'bg-[#02111B] text-white shadow-lg scale-105'
              : 'bg-white text-[#5D737E] border border-[#02111B]/10 hover:border-[#5D737E]/30'
          )}
        >
          Бүгд
        </button>
        {categories.map((category) => (
          <button
            key={category._id}
            onClick={() => handleCategoryClick(category._id)}
            className={cn(
              'px-5 py-2 rounded-full whitespace-nowrap transition-all duration-300 text-sm font-light tracking-wide',
              selectedCategoryId === category._id
                ? 'bg-[#02111B] text-white shadow-lg scale-105'
                : 'bg-white text-[#5D737E] border border-[#02111B]/10 hover:border-[#5D737E]/30'
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-16">
          <p className="text-[#5D737E] text-sm font-light">Ачааллаж байна...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#5D737E] font-light">Бараа олдсонгүй</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {products.map((product, index) => (
            <ProductCard key={product._id} product={product} priority={index < 4} />
          ))}
        </div>
      )}
    </div>
  );
}

// Force dynamic rendering since we use search params
export const dynamic = 'force-dynamic';

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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <p className="text-[#5D737E] text-sm font-light">Ачааллаж байна...</p>
          </div>
        }>
          <ProductsContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
