'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/products/ProductCard';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  stock?: number;
}

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [discountedProducts, setDiscountedProducts] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  // Redirect admin users to admin pages
  useEffect(() => {
    if (user?.role === 'admin') {
      router.push('/admin/orders');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        
        // Fetch all product types
        const [allProductsRes, featuredRes, discountedRes] = await Promise.all([
          api.get('/products'),
          api.get('/products/featured').catch(() => ({ data: { products: [] } })),
          api.get('/products/discounted').catch(() => ({ data: { products: [] } }))
        ]);

        const allProducts = allProductsRes.data.products || [];
        
        // Get featured products
        const featured = featuredRes.data.products || allProducts.filter((p: Product) => p.features?.isFeatured);
        setFeaturedProducts(featured);
        
        // Get discounted products
        const discounted = discountedRes.data.products || allProducts.filter((p: Product) => p.features?.isDiscounted);
        setDiscountedProducts(discounted);
        
        // Get new products
        const newProds = allProducts.filter((p: Product) => p.features?.isNew);
        setNewProducts(newProds);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const ProductSection = ({ 
    title, 
    products, 
    link 
  }: { 
    title: string; 
    products: Product[]; 
    link: string;
  }) => {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [canScrollRight, setCanScrollRight] = useState(false);

    useEffect(() => {
      const checkScroll = () => {
        if (scrollContainerRef.current) {
          const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
          setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
        }
      };
      
      // Check initially and after a short delay to ensure DOM is ready
      checkScroll();
      const timeout = setTimeout(checkScroll, 100);
      
      const container = scrollContainerRef.current;
      if (container) {
        container.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);
        return () => {
          clearTimeout(timeout);
          container.removeEventListener('scroll', checkScroll);
          window.removeEventListener('resize', checkScroll);
        };
      }
    }, [products]);

    const scrollRight = () => {
      if (scrollContainerRef.current) {
        const cardWidth = scrollContainerRef.current.querySelector('div')?.clientWidth || 200;
        scrollContainerRef.current.scrollBy({ left: cardWidth * 2 + 24, behavior: 'smooth' });
      }
    };

    if (products.length === 0) {
      return null;
    }

    return (
      <section className="mb-8 md:mb-12">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-lg md:text-2xl font-semibold">{title}</h2>
          <Link href={link} className="text-xs md:text-sm text-gray-600 hover:text-black transition-colors">
            Бүгдийг үзэх →
          </Link>
        </div>
        
        <div className="relative">
          <div 
            ref={scrollContainerRef}
            className="flex gap-2 md:gap-6 overflow-x-auto scrollbar-hide pb-2 scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {products.map((product, index) => (
              <div key={product._id} className="flex-shrink-0 w-[calc(50%-4px)] md:w-[calc(25%-18px)] snap-start h-full">
                <ProductCard product={product} priority={index < 4} />
              </div>
            ))}
          </div>
          
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-2 w-24 bg-gradient-to-l from-white via-white/90 to-transparent pointer-events-none flex items-center justify-end pr-2">
              <Button
                variant="outline"
                size="sm"
                onClick={scrollRight}
                className="text-xs md:text-sm pointer-events-auto shadow-sm bg-white/95"
              >
                Цааш үзэх →
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1">
        {loading ? (
          <div className="text-center py-12 text-sm md:text-base">Ачааллаж байна...</div>
        ) : (
          <>
            <ProductSection 
              title="Онцлох бараа" 
              products={featuredProducts} 
              link="/products?featured=true"
            />
            <ProductSection 
              title="Хямдарсан бараа" 
              products={discountedProducts} 
              link="/products?discounted=true"
            />
            <ProductSection 
              title="Шинэ бараа" 
              products={newProducts} 
              link="/products?new=true"
            />
            
            {featuredProducts.length === 0 && discountedProducts.length === 0 && newProducts.length === 0 && (
              <div className="text-center py-12 text-xs md:text-sm text-gray-400">
                Бараа олдсонгүй
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
