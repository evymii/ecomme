'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Sidebar from '@/components/profile/Sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Trash2, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { useFavoritesStore, FavoriteProduct } from '@/store/favorites-store';
import { useCartStore } from '@/store/cart-store';
import { getImageUrl } from '@/lib/image-utils';
import Loader from '@/components/ui/Loader';

export default function FavoritesPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const favorites = useFavoritesStore((state) => state.items);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
  const addItem = useCartStore((state) => state.addItem);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userRole = user?.role;
  useEffect(() => {
    if (userRole === 'admin') {
      router.push('/admin/orders');
    }
  }, [userRole, router]);

  const handleAddToCart = (product: FavoriteProduct) => {
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
    });
  };

  if (!mounted) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col">
      <Header />
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 flex-1">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <Sidebar />
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-semibold mb-1">Зүрхэлсэн</h1>
            <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6">
              Таны дуртай бараанууд ({favorites.length})
            </p>

            {favorites.length === 0 ? (
              <Card>
                <CardContent className="p-4 md:p-12">
                  <div className="flex flex-col items-center justify-center py-8 md:py-12">
                    <div className="w-20 h-20 md:w-24 md:h-24 border-2 border-gray-300 rounded-full flex items-center justify-center mb-4 md:mb-6">
                      <Heart className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
                    </div>
                    <h2 className="text-lg md:text-2xl font-semibold mb-2">Зүрхэлсэн бараа байхгүй</h2>
                    <p className="text-xs md:text-base text-gray-500 mb-4 md:mb-6 text-center max-w-md px-2">
                      Бараа дээрх зүрхэн дээр дараад дуртай бараануудаа хадгална уу
                    </p>
                    <Link href="/products">
                      <Button size="sm" className="text-xs md:text-sm">Бараа үзэх</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {favorites.map((product) => (
                  <Card key={product._id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4">
                        {/* Product image */}
                        <Link href={`/products/${product._id}`} className="flex-shrink-0">
                          <div className="relative w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-xl overflow-hidden">
                            {product.image ? (
                              <Image
                                src={getImageUrl(product.image)}
                                alt={product.name}
                                fill
                                className="object-cover"
                                unoptimized
                                sizes="96px"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">Зураг</div>
                            )}
                          </div>
                        </Link>

                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <Link href={`/products/${product._id}`}>
                            <h3 className="text-sm md:text-base font-medium text-[#02111B] line-clamp-2 hover:underline">
                              {product.name}
                            </h3>
                          </Link>
                          {product.code && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{product.code}</p>
                          )}
                          <p className="text-sm md:text-base font-semibold text-[#02111B] mt-1">
                            ₮{product.price.toLocaleString()}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleAddToCart(product)}
                            className="w-9 h-9 md:w-10 md:h-10 bg-[#02111B] text-white rounded-full flex items-center justify-center hover:bg-[#3F4045] transition-colors"
                            title="Сагслах"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeFavorite(product._id)}
                            className="w-9 h-9 md:w-10 md:h-10 border border-red-200 text-red-500 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
                            title="Устгах"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
