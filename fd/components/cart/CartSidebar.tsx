'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart-store';
import { X, Plus, Minus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getImageUrl } from '@/lib/image-utils';
import { cn } from '@/lib/utils';

interface CartSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CartSidebar({ open, onOpenChange }: CartSidebarProps) {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const total = useCartStore((state) => state.getTotal());

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => onOpenChange(false)}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-96 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="p-4 md:p-4 pb-3 md:pb-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base md:text-base font-semibold">Таны сагс</h2>
            <div className="flex items-center gap-3 md:gap-3">
              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-sm md:text-sm text-gray-600 hover:text-black transition-colors font-medium"
                >
                  Хоослох
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-black p-1.5 transition-colors"
              >
                <X className="w-5 h-5 md:w-4 md:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 md:py-12 px-4 md:px-4">
            <div className="w-24 h-24 md:w-24 md:h-24 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center mb-4 md:mb-4">
              <svg
                className="w-14 h-14 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <p className="text-sm md:text-sm text-gray-500 mb-2 md:mb-2 font-medium">Сагс хоосон байна</p>
            <p className="text-xs md:text-sm text-gray-400">Сагсанд бараа нэмэхгүй байна</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 md:px-4 py-3 md:py-3">
              <div className="space-y-3 md:space-y-3">
                {items.map((item) => (
                  <div key={`${item.productId}-${item.size || 'default'}`} className="flex gap-3 md:gap-3">
                    {/* Image */}
                    <div className="relative w-20 h-20 md:w-16 md:h-16 bg-gray-200 rounded flex-shrink-0">
                      {item.image ? (
                        <Image
                          src={getImageUrl(item.image)}
                          alt={item.name}
                          fill
                          className="object-cover rounded"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span className="text-xs md:text-xs">Зураг</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm md:text-sm mb-1 md:mb-1 line-clamp-2">{item.name}</h4>
                      {item.size && (
                        <p className="text-xs md:text-xs text-gray-500 mb-1">Хэмжээ: {item.size}</p>
                      )}
                      <p className="text-xs md:text-xs text-gray-600 mb-2 md:mb-2 font-medium">
                        ₮{item.price.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2 md:gap-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1, item.size)}
                          className="w-7 h-7 md:w-6 md:h-6 flex items-center justify-center border rounded hover:bg-gray-100 text-sm md:text-xs transition-colors font-medium"
                        >
                          <Minus className="w-3.5 h-3.5 md:w-3 md:h-3" />
                        </button>
                        <span className="text-sm md:text-sm w-8 md:w-6 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1, item.size)}
                          className="w-7 h-7 md:w-6 md:h-6 flex items-center justify-center border rounded hover:bg-gray-100 text-sm md:text-xs transition-colors font-medium"
                        >
                          <Plus className="w-3.5 h-3.5 md:w-3 md:h-3" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Right side - Remove and Total */}
                    <div className="flex flex-col items-end justify-between">
                      <button
                        onClick={() => removeItem(item.productId, item.size)}
                        className="text-gray-400 hover:text-black mb-auto p-1 transition-colors"
                      >
                        <X className="w-4 h-4 md:w-4 md:h-4" />
                      </button>
                      <p className="text-sm md:text-sm font-semibold mt-2 md:mt-2">
                        ₮{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer - Total and Checkout */}
            <div className="border-t pt-4 md:pt-4 px-4 md:px-4 pb-4 md:pb-4 flex-shrink-0">
              <div className="flex justify-between items-center mb-4 md:mb-4">
                <span className="font-medium text-sm md:text-sm">Захиалгын дүн</span>
                <span className="text-lg md:text-lg font-semibold">
                  ₮{total.toLocaleString()}
                </span>
              </div>
              <Link href="/checkout" className="block">
                <Button className="w-full text-sm md:text-sm h-11 md:h-10" onClick={() => onOpenChange(false)}>
                  Захиалах
                </Button>
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
