'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart-store';
import { useState } from 'react';
import { getImageUrl } from '@/lib/image-utils';

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

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((state) => state.addItem);
  const mainImage = product.images.find(img => img.isMain) || product.images[0];

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity,
      image: mainImage?.url,
    });
  };

  const handleCardClick = () => {
    router.push(`/products/${product._id}`);
  };

  const isOutOfStock = product.stock !== undefined && product.stock === 0;

  return (
    <div 
      className="bg-white rounded-md md:rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col h-full"
      onClick={handleCardClick}
    >
      <div className="relative aspect-square flex-shrink-0 w-full">
        {mainImage ? (
          <Image
            src={getImageUrl(mainImage.url)}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized
            priority={priority}
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-[10px] md:text-xs">Зураг байхгүй</span>
          </div>
        )}
        <button 
          className="absolute top-1 right-1 md:top-2 md:right-2 p-1 md:p-1.5 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-colors z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Heart className="w-2.5 h-2.5 md:w-4 md:h-4 text-gray-600" />
        </button>
        {product.features.isDiscounted && (
          <span className="absolute top-1 left-1 md:top-2 md:left-2 bg-red-500 text-white text-[9px] md:text-xs px-1 md:px-1.5 py-0.5 rounded z-10">
            Хямдарсан
          </span>
        )}
        {isOutOfStock && (
          <span className="absolute top-1 left-1 md:top-2 md:left-2 bg-gray-800 text-white text-[9px] md:text-xs px-1 md:px-1.5 py-0.5 rounded z-10">
            Дууссан
          </span>
        )}
      </div>
      
      <div className="p-2 md:p-4 flex flex-col flex-1">
        <div className="flex-1 mb-1.5 md:mb-3">
          <h3 className="font-medium text-[11px] md:text-base mb-1 md:mb-2 line-clamp-2 min-h-[2rem] md:min-h-[3rem] leading-tight md:leading-normal">
            {product.name}
          </h3>
          <p className="text-sm md:text-xl font-semibold">
            ₮{product.price.toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 mb-1.5 md:mb-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuantity(Math.max(1, quantity - 1));
            }}
            className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 text-[10px] md:text-sm transition-colors font-medium"
          >
            -
          </button>
          <span className="flex-1 text-center text-[10px] md:text-base font-medium">{quantity}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuantity(quantity + 1);
            }}
            className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 text-[10px] md:text-sm transition-colors font-medium"
          >
            +
          </button>
        </div>

        <Button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className="w-full text-[9px] md:text-sm h-7 md:h-9 bg-black hover:bg-gray-800 text-white py-1 md:py-2"
          size="sm"
        >
          {isOutOfStock ? 'Дууссан' : 'Сагсанд нэмэх'}
        </Button>
      </div>
    </div>
  );
}
