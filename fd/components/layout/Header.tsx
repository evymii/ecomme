'use client';

import Link from 'next/link';
import { ShoppingCart, User, LogOut, Menu, X } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { useAuthStore } from '@/store/auth-store';
import AuthModal from '@/components/auth/AuthModal';
import CartSidebar from '@/components/cart/CartSidebar';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { href: '/admin/orders', label: 'Захиалгууд' },
  { href: '/admin/users', label: 'Хэрэглэгчид' },
  { href: '/admin/categories', label: 'Ангилал' },
  { href: '/admin/products', label: 'Бараа' },
];

export default function Header() {
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const itemCount = useCartStore((state) => state.getItemCount());
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const pathname = usePathname();

  // Track if component is mounted (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Check auth on mount only once
    const token = localStorage.getItem('token');
    if (token && !user) {
      let isMounted = true;
      
      api.get('/users/profile')
        .then((response) => {
          if (isMounted && response.data.success) {
            useAuthStore.getState().setUser(response.data.user);
            useAuthStore.getState().setToken(token);
          }
        })
        .catch(() => {
          if (isMounted) {
            localStorage.removeItem('token');
          }
        });
      
      return () => {
        isMounted = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <>
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between w-full">
            <Link href="/" className="text-lg md:text-2xl font-semibold md:font-bold">
              Az Souvenir
            </Link>
            
            {user?.role === 'admin' ? (
              <nav className="hidden md:flex gap-6 absolute left-1/2 transform -translate-x-1/2">
                {adminNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'text-sm hover:text-gray-600 transition-colors whitespace-nowrap',
                      pathname === item.href
                        ? 'text-black font-medium border-b-2 border-black pb-1'
                        : 'text-gray-600'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ) : (
              <nav className="hidden md:flex gap-6 absolute left-1/2 transform -translate-x-1/2">
                <Link 
                  href="/" 
                  className={cn(
                    'text-sm hover:text-gray-600 transition-colors',
                    pathname === '/' ? 'text-black font-medium border-b-2 border-black pb-1' : 'text-gray-600'
                  )}
                >
                  Бүгд
                </Link>
                <Link 
                  href="/products" 
                  className={cn(
                    'text-sm hover:text-gray-600 transition-colors',
                    pathname?.startsWith('/products') ? 'text-black font-medium border-b-2 border-black pb-1' : 'text-gray-600'
                  )}
                >
                  Бүтээгдэхүүн
                </Link>
              </nav>
            )}

            <div className="flex items-center gap-2 md:gap-3 ml-auto">
              {user?.role !== 'admin' && (
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative p-2 md:p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ShoppingCart className="w-6 h-6 md:w-5 md:h-5" />
                  {mounted && itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-black text-white text-xs md:text-xs rounded-full w-5 h-5 md:w-5 md:h-5 flex items-center justify-center font-semibold">
                      {itemCount}
                    </span>
                  )}
                </button>
              )}

              {user ? (
                <>
                  {user.role === 'admin' && (
                    <button
                      onClick={() => setMobileMenuOpen(true)}
                      className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full md:hidden transition-colors"
                      aria-label="Open menu"
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                  )}
                  {user.role !== 'admin' && (
                    <Link
                      href="/profile"
                      className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors"
                      title={user.name}
                    >
                      <User className="w-4 h-4 md:w-5 md:h-5" />
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Гарах"
                  >
                    <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <User className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              )}
            </div>
          </div>

          {user?.role !== 'admin' && (
            <nav className="md:hidden flex gap-4 mt-3">
              <Link 
                href="/" 
                className={cn(
                  'text-sm transition-colors',
                  pathname === '/' ? 'text-black font-medium' : 'text-gray-600'
                )}
              >
                Бүгд
              </Link>
              <Link 
                href="/products" 
                className={cn(
                  'text-sm transition-colors',
                  pathname?.startsWith('/products') ? 'text-black font-medium' : 'text-gray-600'
                )}
              >
                Бүтээгдэхүүн
              </Link>
            </nav>
          )}
        </div>
      </header>

      {/* Admin Mobile Sidebar */}
      {user?.role === 'admin' && mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed top-0 right-0 h-full w-64 bg-white z-50 shadow-2xl md:hidden transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-3 border-b">
                <h2 className="text-sm font-medium">Цэс</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 p-3 overflow-y-auto">
                <div className="space-y-1">
                  {adminNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'block px-3 py-2 text-sm rounded-md transition-colors',
                        pathname === item.href
                          ? 'bg-black text-white font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>
              <div className="p-3 border-t">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Нүүр хуудас руу буцах
                </Link>
              </div>
            </div>
          </aside>
        </>
      )}

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <CartSidebar open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
