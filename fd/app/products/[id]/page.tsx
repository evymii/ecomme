'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, ShoppingCart, Truck, Shield } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/products/ProductCard';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/image-utils';
import { useCartStore } from '@/store/cart-store';
import { useAuthStore } from '@/store/auth-store';

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
  sizes?: string[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);

  // Redirect admin users
  const userRole = user?.role;
  useEffect(() => {
    if (userRole === 'admin') {
      router.push('/admin/orders');
    }
  }, [userRole, router]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/products/${productId}`);
        if (response.data.success && response.data.product) {
          const productData = response.data.product;
          // Sort images: main first, then by order
          const sortedImages = [...(productData.images || [])].sort((a: ProductImage, b: ProductImage) => {
            if (a.isMain) return -1;
            if (b.isMain) return 1;
            return (a.order || 0) - (b.order || 0);
          });
          setProduct({ ...productData, images: sortedImages });
          
          // Set default size if sizes exist
          if (productData.sizes && productData.sizes.length > 0) {
            setSelectedSize(productData.sizes[0]);
          }
          
          // Fetch similar products from same category, fallback to all products
          try {
            let similar: Product[] = [];

            // First try: same category
            if (productData.category) {
              const encodedCategory = encodeURIComponent(productData.category);
              const similarResponse = await api.get(`/products/category/${encodedCategory}`);
              similar = (similarResponse.data.products || []).filter(
                (p: Product) => p._id !== productId
              );
            }

            // Fallback: if not enough from same category, fetch all products
            if (similar.length < 4) {
              const allResponse = await api.get('/products');
              const allOther = (allResponse.data.products || []).filter(
                (p: Product) => p._id !== productId
              );
              // Merge: category products first, then fill with others (no duplicates)
              const existingIds = new Set(similar.map((p: Product) => p._id));
              for (const p of allOther) {
                if (!existingIds.has(p._id)) {
                  similar.push(p);
                }
              }
            }

            setSimilarProducts(similar.slice(0, 8));
          } catch (error) {
            console.error('Error fetching similar products:', error);
            setSimilarProducts([]);
          }
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.images[0]?.url,
      size: selectedSize || undefined,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCFCFC]">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center py-12">
            <p className="text-[#5D737E] text-sm font-light">Ачааллаж байна...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FCFCFC]">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center py-12 space-y-4">
            <p className="text-[#3F4045] font-light">Бараа олдсонгүй</p>
            <button 
              onClick={() => router.push('/products')} 
              className="px-6 py-2.5 border border-[#02111B]/20 text-[#02111B] rounded-full hover:bg-white transition-all font-light text-sm"
            >
              Бараа руу буцах
            </button>
          </div>
        </main>
      </div>
    );
  }

  const currentImage = product.images[selectedImageIndex] || product.images[0];
  const isOutOfStock = product.stock === 0;

  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 flex-1 w-full">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-[#5D737E] hover:text-[#02111B] transition-colors mb-6 md:mb-8 font-light text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Буцах
        </button>

        {/* Product Details */}
        <div className="mb-8 md:mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
            {/* Left: Image Area (thumbnails + main image) */}
            <div className="flex gap-2 md:gap-3">
              {/* Thumbnail Gallery - left side of main image */}
              {product.images.length > 1 && (
                <div className="w-14 md:w-20 flex-shrink-0">
                  <div className="flex flex-col gap-1.5 md:gap-2.5 h-full overflow-y-auto scrollbar-hide">
                    {product.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`relative w-full aspect-square rounded-lg md:rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                          index === selectedImageIndex
                            ? 'border-[#02111B] shadow-md'
                            : 'border-[#02111B]/10 hover:border-[#5D737E]/40'
                        }`}
                      >
                        <Image
                          src={getImageUrl(image.url)}
                          alt={`${product.name} - ${index + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                          sizes="80px"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Image */}
              <div className="flex-1 min-w-0">
                <div className="relative aspect-square bg-gradient-to-br from-[#5D737E]/5 to-transparent rounded-2xl md:rounded-3xl overflow-hidden">
                  {currentImage ? (
                    <Image
                      src={getImageUrl(currentImage.url)}
                      alt={product.name}
                      fill
                      className="object-cover"
                      priority
                      unoptimized
                      sizes="(max-width: 768px) 80vw, (max-width: 1024px) 45vw, 40vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[#5D737E]/40 text-sm font-light">Зураг байхгүй</span>
                    </div>
                  )}

                  {/* Feature Badges */}
                  <div className="absolute top-3 left-3 md:top-4 md:left-4 flex flex-wrap gap-1.5 md:gap-2">
                    {product.features.isNew && (
                      <span className="px-2.5 py-1 bg-[#02111B]/80 backdrop-blur-sm text-[#FCFCFC] rounded-full text-[10px] md:text-xs font-light tracking-wide">
                        Шинэ
                      </span>
                    )}
                    {product.features.isFeatured && (
                      <span className="px-2.5 py-1 bg-[#5D737E]/80 backdrop-blur-sm text-[#FCFCFC] rounded-full text-[10px] md:text-xs font-light tracking-wide">
                        Онцлох
                      </span>
                    )}
                    {product.features.isDiscounted && (
                      <span className="px-2.5 py-1 bg-[#30292F]/80 backdrop-blur-sm text-[#FCFCFC] rounded-full text-[10px] md:text-xs font-light tracking-wide">
                        Хямдрал
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Product Information */}
            <div className="space-y-5 md:space-y-6">
              {/* Title & Code */}
              <div>
                {product.code && (
                  <p className="text-xs text-[#5D737E] font-mono mb-1.5 tracking-wide">{product.code}</p>
                )}
                <h1 className="text-xl md:text-2xl text-[#02111B] tracking-tight" style={{ fontWeight: 600 }}>
                  {product.name}
                </h1>
              </div>

              {/* Price */}
              <div>
                <p className="text-2xl md:text-3xl text-[#02111B] tracking-tight" style={{ fontWeight: 600 }}>
                  ₮{product.price.toLocaleString()}
                </p>
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-sm text-[#3F4045] leading-relaxed whitespace-pre-line font-light">
                  {product.description}
                </p>
              )}

              {/* Size Selection */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="space-y-3">
                  <span className="text-sm text-[#02111B] tracking-tight" style={{ fontWeight: 500 }}>Хэмжээ</span>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 text-sm rounded-full transition-all min-w-[3rem] font-light tracking-wide ${
                          selectedSize === size
                            ? 'bg-[#02111B] text-white'
                            : 'bg-white text-[#3F4045] border border-[#02111B]/10 hover:border-[#5D737E]/30'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#02111B] tracking-tight" style={{ fontWeight: 500 }}>Тоо ширхэг</span>
                <div className="flex items-center border border-[#02111B]/10 rounded-full overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 flex items-center justify-center hover:bg-[#5D737E]/10 transition-colors text-sm text-[#3F4045]"
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-sm text-[#02111B]" style={{ fontWeight: 500 }}>{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-9 h-9 flex items-center justify-center hover:bg-[#5D737E]/10 transition-colors text-sm text-[#3F4045]"
                    disabled={quantity >= product.stock}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Info Chips */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 text-sm text-[#5D737E] font-light">
                  <div className="w-7 h-7 rounded-full bg-[#5D737E]/10 flex items-center justify-center">
                    <Truck className="w-3.5 h-3.5 text-[#5D737E]" />
                  </div>
                  <span>Хүргэлттэй</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#5D737E] font-light">
                  <div className="w-7 h-7 rounded-full bg-[#30292F]/10 flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5 text-[#30292F]" />
                  </div>
                  <span>Баталгаат</span>
                </div>
              </div>

              {/* Stock */}
              <p className="text-sm font-light">
                <span className="text-[#3F4045]">Нөөц: </span>
                <span className={product.stock > 0 ? 'text-[#5D737E]' : 'text-red-500'} style={{ fontWeight: 500 }}>
                  {product.stock > 0 ? `${product.stock} ширхэг` : 'Дууссан'}
                </span>
              </p>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="w-full h-12 px-6 border border-[#02111B]/20 text-[#02111B] rounded-full hover:bg-white hover:border-[#5D737E]/30 transition-all duration-300 font-light text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {isOutOfStock ? 'Дууссан' : 'Сагслах'}
                </button>
                <button
                  onClick={() => {
                    handleAddToCart();
                    router.push('/checkout');
                  }}
                  disabled={isOutOfStock}
                  className="w-full h-12 px-6 bg-[#02111B] text-white rounded-full hover:bg-[#3F4045] transition-all duration-300 hover:shadow-xl font-light text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Захиалах
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Similar Products Section */}
        {similarProducts.length > 0 && (
          <div className="mt-10 md:mt-16 border-t border-[#02111B]/5 pt-10 md:pt-14">
            <h2 className="text-xl md:text-2xl text-[#02111B] tracking-tight mb-6 md:mb-8" style={{ fontWeight: 600 }}>
              Төстэй бүтээгдэхүүн
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {similarProducts.map((similarProduct) => (
                <ProductCard key={similarProduct._id} product={similarProduct} />
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
