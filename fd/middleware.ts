import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect /admin routes — check token cookie exists
  // Actual admin role verification happens in useAdminAuth hook (calls backend /admin/check)
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
