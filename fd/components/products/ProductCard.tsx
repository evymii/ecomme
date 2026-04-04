'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Heart } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { useFavoritesStore } from '@/store/favorites-store';
import { useState, useEffect, memo, useCallback } from 'react';
import { getImageUrl } from '@/lib/image-utils';

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
  category?: string;
  stock?: number;
}

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  categoryName?: string;
}

function ProductCard({ product, priority = false, categoryName }: ProductCardProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFav = useFavoritesStore((state) => state.items.some(item => item._id === product._id));
  const mainImage = product.images.find(img => img.isMain) || product.images[0];

  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: mainImage?.url,
    });
  }, [addItem, product._id, product.name, product.price, mainImage?.url]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite({
      _id: product._id,
      name: product.name,
      price: product.price,
      code: product.code,
      image: mainImage?.url,
      category: product.category,
    });
  }, [toggleFavorite, product._id, product.name, product.price, product.code, mainImage?.url, product.category]);

  const handleCardClick = useCallback(() => {
    router.push(`/products/${product._id}`);
  }, [router, product._id]);

  const isOutOfStock = product.stock !== undefined && product.stock === 0;
  const lowStock = product.stock !== undefined && product.stock > 0 && product.stock <= 3;

  // Determine badge text
  const getBadge = () => {
    if (isOutOfStock) return { text: 'Дууссан', bg: 'bg-[#30292F]/80' };
    if (product.features.isDiscounted) return { text: 'Хямдрал', bg: 'bg-[#30292F]/80' };
    if (product.features.isNew) return { text: 'Шинэ', bg: 'bg-[#02111B]/80' };
    if (categoryName) return { text: categoryName, bg: 'bg-[#02111B]/80' };
    return null;
  };

  const badge = getBadge();

  // Get stock status color
  const getStockColor = () => {
    if (isOutOfStock) return 'text-red-500';
    if (lowStock) return 'text-orange-500';
    return 'text-[#5D737E]';
  };

  return (
    <div
      className="group relative bg-white rounded-[20px] overflow-hidden transition-all duration-300 hover:shadow-2xl border border-[#02111B]/8 cursor-pointer flex flex-col h-full hover:border-[#02111B]/15"
      onClick={handleCardClick}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#5D737E]/8 to-[#02111B]/2 flex-shrink-0">
        {mainImage ? (
          <Image
            src={getImageUrl(mainImage.url)}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#5D737E]/10 to-[#02111B]/5 flex items-center justify-center">
            <span className="text-[#5D737E]/40 text-xs font-light">Зураг байхгүй</span>
          </div>
        )}

        {/* Badge */}
        {badge && (
          <div className="absolute top-2.5 left-2.5 md:top-3 md:left-3 z-10">
            <span className={`px-2.5 py-1 ${badge.bg} backdrop-blur-sm text-[#FCFCFC] rounded-full text-[10px] md:text-xs font-light tracking-wide`}>
              {badge.text}
            </span>
          </div>
        )}

        {/* Product code overlay */}
        {product.code && (
          <div className="absolute bottom-2.5 left-2.5 md:bottom-3 md:left-3 z-10">
            <span className="px-2 py-0.5 bg-white/80 backdrop-blur-sm text-[#3F4045] rounded-full text-[9px] md:text-[10px] font-mono tracking-wide">
              {product.code}
            </span>
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          className="absolute top-2.5 right-2.5 md:top-3 md:right-3 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-all duration-300 z-20 bg-white/70 backdrop-blur-sm hover:bg-white/90 shadow-sm"
        >
          <Heart
            className={`w-4 h-4 md:w-[18px] md:h-[18px] transition-colors ${
              isFav ? 'fill-red-500 text-red-500' : 'text-[#3F4045]'
            }`}
          />
        </button>

        {/* Quick Add Button */}
        {!isOutOfStock && (
          <button
            onClick={handleAddToCart}
            className="absolute bottom-2.5 right-2.5 md:bottom-3 md:right-3 w-9 h-9 md:w-10 md:h-10 bg-[#02111B] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-[#3F4045] hover:scale-110 shadow-lg z-10"
          >
            <ShoppingCart className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
        )}
      </div>

      {/* Product Info */}
      <div className="p-2 md:p-2.5 flex flex-col flex-1 space-y-1 md:space-y-1.5">
        {/* Product Name */}
        <div className="flex-1 min-h-[2rem]">
          <h3 className="font-normal text-[#02111B] line-clamp-2 tracking-tight text-xs leading-snug" style={{ fontWeight: 400 }}>
            {product.name}
          </h3>
        </div>

        {/* Price, Stock and Action */}
        <div className="flex items-flex-start justify-between gap-1.5">
          {/* Price */}
          <span className="font-semibold text-[#02111B] tracking-tight text-xs md:text-sm" style={{ fontWeight: 600 }}>
            ₮{product.price.toLocaleString()}
          </span>

          {/* Stock Status + Arrow - Stacked on Right */}
          <div className="flex flex-col items-end gap-0.25">
            {product.stock !== undefined && (
              <div className="flex items-center gap-1">
                <div className={`h-1.5 md:h-2 w-1.5 md:w-2 rounded-full ${
                  isOutOfStock ? 'bg-red-500' : lowStock ? 'bg-orange-500' : 'bg-green-500'
                }`}></div>
                <span className={`text-[9px] md:text-[10px] font-light ${getStockColor()}`}>
                  {isOutOfStock
                    ? 'Дууссан'
                    : lowStock
                    ? `${product.stock}`
                    : `${product.stock}`}
                </span>
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
              className="text-[#5D737E] hover:text-[#02111B] transition-colors font-light hover:bg-[#5D737E]/5 rounded-full leading-none"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCard);
