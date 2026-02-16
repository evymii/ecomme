import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect /admin routes with our cookie-based check
  if (pathname.startsWith('/admin')) {
    const adminCookie = req.cookies.get('admin_verified')?.value;
    if (!adminCookie) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Only run middleware on admin routes
    '/admin/:path*',
  ],
};
