'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/products/ProductCard';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

interface Product {
  _id: string;
  name: string;
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

  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        {/* Sidebar - Categories */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white border rounded-lg p-4">
            <h2 className="font-semibold text-sm md:text-base mb-3 md:mb-4">Ангилал</h2>
            <div className="space-y-2">
              <button
                onClick={() => handleCategoryClick(null)}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs md:text-sm rounded-md transition-colors',
                  selectedCategoryId === null
                    ? 'bg-black text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                Бүх бүтээгдэхүүн
              </button>
              {categories.map((category) => (
                <button
                  key={category._id}
                  onClick={() => handleCategoryClick(category._id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs md:text-sm rounded-md transition-colors',
                    selectedCategoryId === category._id
                      ? 'bg-black text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h1 className="text-xl md:text-3xl font-semibold md:font-bold">
              Бүтээгдэхүүнүүд
            </h1>
            {/* Sort options can be added here */}
          </div>

          {loading ? (
            <div className="text-center py-8 md:py-12 text-sm md:text-base">Ачааллаж байна...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-xs md:text-sm text-gray-400">
              Бараа олдсонгүй
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-6">
              {products.map((product, index) => (
                <ProductCard key={product._id} product={product} priority={index < 4} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Force dynamic rendering since we use search params
export const dynamic = 'force-dynamic';

export default function ProductsPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  // Redirect admin users to admin pages
  useEffect(() => {
    if (user?.role === 'admin') {
      router.push('/admin/orders');
      return;
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-4 md:py-8 flex-1">
        <Suspense fallback={<div className="text-center py-8 md:py-12 text-sm md:text-base">Ачааллаж байна...</div>}>
          <ProductsContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
