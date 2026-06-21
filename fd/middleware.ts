import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getApiBaseUrl() {
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!rawApiUrl && process.env.NODE_ENV === 'production') return null;

  const apiUrl = rawApiUrl || 'http://localhost:5001/api';
  const normalizedApiUrl = apiUrl.replace(/\/+$/, '');
  return normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('auth_token')?.value;

    const redirectHome = () => {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    };

    if (!token) {
      return redirectHome();
    }

    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      return redirectHome();
    }

    try {
      const response = await fetch(`${apiBaseUrl}/admin/check`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        return redirectHome();
      }

      const data = await response.json();
      if (!data?.success || !data?.isAdmin) {
        return redirectHome();
      }
    } catch (_error) {
      return redirectHome();
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
