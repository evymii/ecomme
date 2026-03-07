import HomePageClient from '@/components/home/HomePageClient';

export const revalidate = 60;

type HomeData = {
  featuredProducts: any[];
  discountedProducts: any[];
  allProducts: any[];
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
    categories: [],
  };

  try {
    const res = await fetch(`${getApiBaseUrl()}/public/home`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) return fallback;
    const data = await res.json();
    if (!data?.success) return fallback;

    return {
      featuredProducts: data.featuredProducts || [],
      discountedProducts: data.discountedProducts || [],
      allProducts: data.allProducts || [],
      categories: data.categories || [],
    };
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const initialData = await getHomeData();
  return <HomePageClient initialData={initialData} />;
}
