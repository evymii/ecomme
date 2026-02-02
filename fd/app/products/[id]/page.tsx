'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, ShoppingCart, Truck } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/products/ProductCard';
import { Button } from '@/components/ui/button';
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
  useEffect(() => {
    if (user?.role === 'admin') {
      router.push('/admin/orders');
    }
  }, [user, router]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/products/${productId}`);
        if (response.data.success && response.data.product) {
          const productData = response.data.product;
          // Sort images: main first, then by order
          const sortedImages = [...(productData.images || [])].sort((a, b) => {
            if (a.isMain) return -1;
            if (b.isMain) return 1;
            return (a.order || 0) - (b.order || 0);
          });
          setProduct({ ...productData, images: sortedImages });
          
          // Set default size if sizes exist
          if (productData.sizes && productData.sizes.length > 0) {
            setSelectedSize(productData.sizes[0]);
          }
          
          // Fetch similar products from same category
          if (productData.category) {
            try {
              // Encode the category name for URL
              const encodedCategory = encodeURIComponent(productData.category);
              const similarResponse = await api.get(`/products/category/${encodedCategory}`);
              const similar = (similarResponse.data.products || []).filter(
                (p: Product) => p._id !== productId
              ).slice(0, 8);
              setSimilarProducts(similar);
            } catch (error) {
              // Silently fail - similar products are optional
              console.error('Error fetching similar products:', error);
              setSimilarProducts([]);
            }
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
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-4 md:py-8">
          <div className="text-center py-12 text-sm md:text-base">Ачааллаж байна...</div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-4 md:py-8">
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Бараа олдсонгүй</p>
            <Button onClick={() => router.push('/products')} variant="outline">
              Бараа руу буцах
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const currentImage = product.images[selectedImageIndex] || product.images[0];
  const isOutOfStock = product.stock === 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-4 md:py-8 flex-1">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 md:mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Буцах
        </Button>

        {/* Product Details */}
        <div className="bg-white rounded-lg overflow-hidden mb-6 md:mb-8">
          <div className="grid grid-cols-12 gap-2 md:gap-4 lg:gap-8">
            {/* Main Image */}
            <div className={`${product.images.length > 1 ? 'col-span-10 md:col-span-7' : 'col-span-12 md:col-span-8'}`}>
              <div className="relative aspect-square bg-gray-50 rounded-md md:rounded-lg overflow-hidden">
                {currentImage ? (
                  <Image
                    src={getImageUrl(currentImage.url)}
                    alt={product.name}
                    fill
                    className="object-cover"
                    priority
                    unoptimized
                    sizes="(max-width: 768px) 80vw, (max-width: 1024px) 60vw, 50vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-400 text-xs md:text-sm">Зураг байхгүй</span>
                  </div>
                )}

                {/* Feature Badges */}
                <div className="absolute top-2 left-2 md:top-3 md:left-3 flex flex-wrap gap-1 md:gap-2">
                  {product.features.isNew && (
                    <span className="bg-green-500 text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded">
                      Шинэ
                    </span>
                  )}
                  {product.features.isFeatured && (
                    <span className="bg-blue-500 text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded">
                      Онцлох
                    </span>
                  )}
                  {product.features.isDiscounted && (
                    <span className="bg-red-500 text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded">
                      Хямдарсан
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Sidebar - Thumbnail Gallery */}
            {product.images.length > 1 && (
              <div className="col-span-2 md:col-span-1">
                <div className="flex flex-col gap-1.5 md:gap-2 h-full">
                  {product.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative w-full aspect-square rounded-md md:rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                        index === selectedImageIndex
                          ? 'border-black'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <Image
                        src={getImageUrl(image.url)}
                        alt={`${product.name} - Image ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="(max-width: 768px) 16vw, (max-width: 1024px) 64px, 80px"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Product Information */}
            <div className={`${product.images.length > 1 ? 'col-span-12 md:col-span-4' : 'col-span-12 md:col-span-4'} space-y-4 md:space-y-6`}>
              {/* Product Title */}
              <div>
                <h1 className="text-xl md:text-2xl font-semibold mb-1">{product.name}</h1>
                {product.code && (
                  <p className="text-xs md:text-sm text-gray-500">Код: {product.code}</p>
                )}
              </div>

              {/* Price */}
              <div>
                <p className="text-2xl md:text-3xl font-bold text-black">
                  ₮{product.price.toLocaleString()}
                </p>
              </div>

              {/* Description */}
              {product.description && (
                <div>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Size Selection */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="space-y-3">
                  <span className="text-sm md:text-base font-semibold block">Хэмжээ:</span>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-3 py-2 text-sm border rounded transition-colors min-w-[3rem] ${
                          selectedSize === size
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-gray-300 hover:border-black'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm md:text-base font-semibold">Тоо ширхэг:</span>
                <div className="flex items-center gap-2 border border-gray-300 rounded">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-sm md:text-base"
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-medium text-sm md:text-base">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-sm md:text-base"
                    disabled={quantity >= product.stock}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Delivery Information */}
              <div className="flex items-center gap-2 text-sm md:text-base text-gray-600">
                <Truck className="w-4 h-4 md:w-5 md:h-5" />
                <span>Хүргэлттэй</span>
              </div>

              {/* Stock Information */}
              <div className="text-sm md:text-base">
                <span className="font-semibold">Нөөц: </span>
                <span className={product.stock > 0 ? 'text-green-600' : 'text-red-600'}>
                  {product.stock > 0 ? `${product.stock} ширхэг` : 'Дууссан'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  variant="outline"
                  className="w-full text-sm md:text-base h-11 md:h-12 border-2 border-gray-300 hover:bg-gray-50"
                  size="lg"
                >
                  <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  {isOutOfStock ? 'Дууссан' : 'Сагслах'}
                </Button>
                <Button
                  onClick={() => {
                    handleAddToCart();
                    router.push('/checkout');
                  }}
                  disabled={isOutOfStock}
                  className="w-full text-sm md:text-base h-11 md:h-12 bg-black hover:bg-gray-800 text-white"
                  size="lg"
                >
                  Захиалах
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Similar Products Section */}
        {similarProducts.length > 0 && (
          <div className="mt-8 md:mt-12">
            <h2 className="text-xl md:text-3xl font-semibold md:font-bold mb-4 md:mb-6">
              Төстэй бүтээгдэхүүн
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
              {similarProducts.map((similarProduct) => (
                <ProductCard key={similarProduct._id} product={similarProduct} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
