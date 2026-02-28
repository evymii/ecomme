'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';
import { useRouter } from 'next/navigation';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ProductImage {
  url: string;
  isMain: boolean;
}

interface Product {
  _id: string;
  code: string;
  name: string;
  price: number;
  images: ProductImage[];
}

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError(false);
      try {
        const response = await api.get(`/products/search?q=${encodeURIComponent(query)}`);
        setResults(response.data.products || []);
        setSearchError(false);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setSearchError(true);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  const handleProductClick = (productId: string) => {
    onOpenChange(false);
    router.push(`/products/${productId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] p-0 gap-0 rounded-lg overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Хайх</DialogTitle>
          <DialogDescription>Бүтээгдэхүүн хайх</DialogDescription>
        </VisuallyHidden>
        
        {/* Search Input */}
        <div className="flex items-center border-b px-4 py-3">
          <Search className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
          <Input
            type="text"
            placeholder="Бүтээгдэхүүн хайх..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 px-0 text-base"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-gray-100 rounded-full ml-2"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              Хайж байна...
            </div>
          ) : searchError ? (
            <div className="p-6 text-center text-red-500 text-sm">
              Хайлт хийхэд алдаа гарлаа. Дахин оролдоно уу.
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y">
              {results.map((product) => {
                const mainImage = product.images.find(img => img.isMain) || product.images[0];
                return (
                  <button
                    key={product._id}
                    onClick={() => handleProductClick(product._id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="relative w-14 h-14 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
                      {mainImage ? (
                        <Image
                          src={getImageUrl(mainImage.url)}
                          alt={product.name}
                          fill
                          className="object-cover"
                          unoptimized
                          sizes="56px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                          No img
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">{product.code}</p>
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-sm text-gray-600">₮{product.price.toLocaleString()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : query.trim() ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              Илэрц олдсонгүй
            </div>
          ) : (
            <div className="p-6 text-center text-gray-400 text-sm">
              Бүтээгдэхүүний нэр эсвэл код оруулна уу
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
