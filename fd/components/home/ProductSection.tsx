'use client';

import Link from 'next/link';
import ProductCard from '@/components/products/ProductCard';

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
}

interface ProductSectionProps {
  title: string;
  products: Product[];
  link: string;
}

export default function ProductSection({ title, products, link }: ProductSectionProps) {
  if (products.length === 0) {
    return (
      <section className="mb-8 md:mb-12">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-semibold">{title}</h2>
          <Link href={link} className="text-sm md:text-base text-gray-600 hover:text-black">
            Цааш үзэх →
          </Link>
        </div>
        <p className="text-gray-400 text-sm md:text-base">Бараа олдсонгүй</p>
      </section>
    );
  }

  return (
    <section className="mb-6 md:mb-12">
      <div className="flex items-center justify-between mb-3 md:mb-6">
        <h2 className="text-lg md:text-2xl font-semibold">{title}</h2>
        <Link href={link} className="text-xs md:text-base text-gray-600 hover:text-black">
          Цааш үзэх →
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
}
