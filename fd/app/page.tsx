import HomePageClient from '@/components/home/HomePageClient';

// Staggered revalidation: featured/discounted products update frequently, categories less often
export const revalidate = 60; // Main ISR interval for the page

type HomeData = {
  featuredProducts: any[];
  discountedProducts: any[];
  allProducts: any[];
  allProductsPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  categories: any[];
};

function getApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:5001/api';
  const noTrailingSlash = raw.replace(/\/+$/, '');
  return noTrailingSlash.endsWith('/api') ? noTrailingSlash : `${noTrailingSlash}/api`;
}

async function getHomeData(): Promise<HomeData> {
  const fallback: HomeData = {
    featuredProducts: [],
    discountedProducts: [],
    allProducts: [],
    allProductsPagination: { page: 1, limit: 16, total: 0, totalPages: 1, hasMore: false },
    categories: [],
  };
  const apiBase = getApiBaseUrl();

  const fetchLegacyHomeData = async (): Promise<HomeData> => {
    try {
      const [featuredRes, discountedRes, productsRes, categoriesRes] = await Promise.all([
        fetch(`${apiBase}/products/featured`, { next: { revalidate: 300 } }), // 5 min
        fetch(`${apiBase}/products/discounted`, { next: { revalidate: 300 } }), // 5 min
        fetch(`${apiBase}/products?page=1&limit=16`, { next: { revalidate: 60 } }), // 1 min
        fetch(`${apiBase}/categories`, { next: { revalidate: 3600 } }), // 1 hour
      ]);

      const [featuredData, discountedData, productsData, categoriesData] = await Promise.all([
        featuredRes.ok ? featuredRes.json() : Promise.resolve({}),
        discountedRes.ok ? discountedRes.json() : Promise.resolve({}),
        productsRes.ok ? productsRes.json() : Promise.resolve({}),
        categoriesRes.ok ? categoriesRes.json() : Promise.resolve({}),
      ]);

      return {
        featuredProducts: featuredData?.products || [],
        discountedProducts: discountedData?.products || [],
        allProducts: productsData?.products || [],
        allProductsPagination: productsData?.pagination || { page: 1, limit: 16, total: 0, totalPages: 1, hasMore: false },
        categories: categoriesData?.categories || [],
      };
    } catch {
      return fallback;
    }
  };

  try {
    const res = await fetch(`${apiBase}/public/home`, {
      next: { revalidate: 120 }, // 2 min - composite endpoint
    });

    if (!res.ok) return fetchLegacyHomeData();
    const data = await res.json();
    if (!data?.success) return fetchLegacyHomeData();

    return {
      featuredProducts: data.featuredProducts || [],
      discountedProducts: data.discountedProducts || [],
      allProducts: data.allProducts || [],
      allProductsPagination: data.allProductsPagination || { page: 1, limit: 16, total: 0, totalPages: 1, hasMore: false },
      categories: data.categories || [],
    };
  } catch {
    return fetchLegacyHomeData();
  }
}

export default async function HomePage() {
  const initialData = await getHomeData();
  return <HomePageClient initialData={initialData} />;
}
