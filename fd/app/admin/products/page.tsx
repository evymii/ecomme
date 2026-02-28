'use client';

import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ProductModal from '@/components/admin/ProductModal';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';
import { Search, X } from 'lucide-react';
import Loader from '@/components/ui/Loader';
import { PageLoader } from '@/components/ui/Loader';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';

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

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoader = useDelayedLoading(loading, 250);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { isAdmin, isChecking } = useAdminAuth();
  const { toast } = useToast();

  // Filter products based on search query
  const filteredProducts = products.filter(product => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.code.toLowerCase().includes(query)
    );
  });

  const fetchProducts = useCallback(async () => {
    try {
      const response = await api.get('/admin/products');
      if (!response.data?.success) {
        toast({
          title: 'Алдаа',
          description: response.data?.message || 'Бараанууд авахад алдаа гарлаа',
          variant: 'destructive',
        });
        return;
      }
      // Normalize products to ensure images have order property
      const normalizedProducts = (response.data.products || []).map((product: any) => ({
        ...product,
        images: (product.images || []).map((img: any, index: number) => ({
          url: img.url,
          isMain: img.isMain || false,
          order: img.order !== undefined ? img.order : index,
        })),
      }));
      setProducts(normalizedProducts);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Бараанууд авахад алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
            description: response.data?.message || 'Барааны дэлгэрэнгүй мэдээлэл авахад алдаа гарлаа',
            variant: 'destructive',
          });
          return;
        }
        setEditingProduct(fullProduct);
        setModalOpen(true);
      } catch (error: any) {
        toast({
          title: 'Алдаа',
          description: error.response?.data?.message || 'Барааны дэлгэрэнгүй мэдээлэл авахад алдаа гарлаа',
          variant: 'destructive',
        });
      }
    };
    openEditModal();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Энэ барааг устгахдаа итгэлтэй байна уу?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-4 md:mb-8">
          <div>
            <h1 className="text-xl md:text-3xl font-semibold md:font-bold mb-1 md:mb-2">
              Барааны удирдлага
            </h1>
            <p className="text-gray-600 text-xs md:text-base">
              Дэлгүүрийн бүх барааг удирдах
            </p>
          </div>
          
          {/* Search and Add Button */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>
            <Button 
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
              size="sm"
              className="whitespace-nowrap"
            >
              Бараа нэмэх
            </Button>
          </div>
        </div>

        {loading && showLoader ? (
          <PageLoader />
        ) : loading ? null : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-6">
            {filteredProducts.map((product) => {
              const mainImage = product.images.find(img => img.isMain) || product.images[0];
              return (
                <Card key={product._id} className="bg-white rounded-md md:rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                  <div className="relative aspect-square flex-shrink-0 w-full">
                    {mainImage ? (
                      <Image
                        src={getImageUrl(mainImage.url)}
                        alt={product.name}
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400 text-[10px] md:text-xs">Зураг байхгүй</span>
                      </div>
                    )}
                    <div className="absolute top-1 right-1 md:top-2 md:right-2 flex gap-0.5 md:gap-1 flex-wrap">
                      {product.features.isNew && (
                        <span className="bg-green-500 text-white text-[9px] md:text-xs px-1 md:px-1.5 py-0.5 rounded">
                          Шинэ
                        </span>
                      )}
                      {product.features.isFeatured && (
                        <span className="bg-blue-500 text-white text-[9px] md:text-xs px-1 md:px-1.5 py-0.5 rounded">
                          Онцлох
                        </span>
                      )}
                      {product.features.isDiscounted && (
                        <span className="bg-red-500 text-white text-[9px] md:text-xs px-1 md:px-1.5 py-0.5 rounded">
                          Хямдарсан
                        </span>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-2 md:p-4 flex flex-col flex-1">
                    <div className="flex-1">
                      <p className="text-[9px] md:text-xs text-gray-500 mb-0.5 md:mb-1">Код: {product.code}</p>
                      <h3 className="font-medium text-[11px] md:text-base mb-1 md:mb-2 line-clamp-2 min-h-[2rem] md:min-h-[3rem] leading-tight md:leading-normal">{product.name}</h3>
                      <p className="text-[10px] md:text-sm text-gray-600 mb-0.5 md:mb-2 line-clamp-1">{product.category}</p>
                      <p className="text-sm md:text-xl font-semibold mb-1 md:mb-3">₮{product.price.toLocaleString()}</p>
                      <p className="text-[10px] md:text-sm text-gray-600 mb-1.5 md:mb-3">
                        Нөөц: {product.stock} ширхэг
                      </p>
                    </div>
                    <div className="flex gap-1 md:gap-2 mt-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(product)}
                        className="flex-1 text-[9px] md:text-sm h-7 md:h-9 whitespace-nowrap"
                      >
                        Засах
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(product._id)}
                        className="flex-1 text-[9px] md:text-sm h-7 md:h-9 whitespace-nowrap"
                      >
                        Устгах
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <ProductModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          product={editingProduct}
          onSuccess={fetchProducts}
        />
      </main>
    </div>
  );
}
