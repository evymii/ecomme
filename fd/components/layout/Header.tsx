'use client';

import Link from 'next/link';
import { ShoppingCart, User, LogOut, Menu, X, Search } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { useAuthStore } from '@/store/auth-store';
import AuthModal from '@/components/auth/AuthModal';
import CartSidebar from '@/components/cart/CartSidebar';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';

interface SearchProduct {
  _id: string;
  code: string;
  name: string;
  price: number;
  images: Array<{ url: string; isMain: boolean }>;
}

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

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

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

  // Debounced search with abort controller to prevent race conditions
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const abortController = new AbortController();
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/products/search?q=${encodeURIComponent(searchQuery)}`, {
          signal: abortController.signal,
        });
        if (!abortController.signal.aborted) {
          setSearchResults(response.data.products || []);
        }
      } catch (error: any) {
        if (!abortController.signal.aborted) {
          console.error('Search error:', error);
          setSearchResults([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDesktop = searchRef.current?.contains(target);
      const inMobile = mobileSearchRef.current?.contains(target);
      if (!inDesktop && !inMobile) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close search on route change
  useEffect(() => {
    setSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleProductClick = useCallback((productId: string) => {
    setSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(`/products/${productId}`);
  }, [router]);

  const showDropdown = searchFocused && searchQuery.trim().length > 0;

  // Render search dropdown as inline JSX (not a component) to avoid unmount/remount on every render
  const searchDropdownContent = showDropdown ? (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#02111B]/10 max-h-[70vh] overflow-y-auto z-50">
      {searchLoading ? (
        <div className="p-5 text-center text-[#5D737E] text-sm font-light">Хайж байна...</div>
      ) : searchResults.length > 0 ? (
        <div className="divide-y divide-[#02111B]/5 py-1">
          {searchResults.map((product) => {
            const mainImage = product.images.find(img => img.isMain) || product.images[0];
            return (
              <button
                key={product._id}
                onMouseDown={(e) => { e.preventDefault(); handleProductClick(product._id); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#5D737E]/5 transition-colors text-left"
              >
                <div className="relative w-11 h-11 flex-shrink-0 bg-gradient-to-br from-[#5D737E]/10 to-transparent rounded-xl overflow-hidden">
                  {mainImage ? (
                    <Image
                      src={getImageUrl(mainImage.url)}
                      alt={product.name}
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="44px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#5D737E]/40 text-[10px]">
                      No img
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-normal text-[#02111B] truncate tracking-tight">{product.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#5D737E] font-light">{product.code}</span>
                    <span className="text-xs font-semibold text-[#02111B] tracking-tight">₮{product.price.toLocaleString()}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-5 text-center text-[#5D737E] text-sm font-light">Илэрц олдсонгүй</div>
      )}
    </div>
  ) : null;

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FCFCFC]/80 backdrop-blur-xl border-b border-[#02111B]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-8">
              {/* Mobile menu button (admin only) */}
              {isAdmin && (
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden text-[#02111B] p-1"
                  aria-label="Open menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}

              {/* Mobile menu toggle for user - shows nav links */}
              {!isAdmin && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden text-[#02111B] p-1"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              )}

              <Link href="/" className="font-semibold text-[#02111B] tracking-tight text-xl">
                Az
              </Link>

              {/* Desktop Navigation */}
              {isAdmin ? (
                <nav className="hidden lg:flex items-center gap-6">
                  {adminNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'transition-colors font-light tracking-wide text-sm',
                        pathname === item.href
                          ? 'text-[#02111B] font-normal'
                          : 'text-[#5D737E] hover:text-[#02111B]'
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              ) : (
                <nav className="hidden lg:flex items-center gap-6">
                  <Link
                    href="/"
                    className={cn(
                      'transition-colors font-light tracking-wide text-sm',
                      pathname === '/' ? 'text-[#02111B] font-normal' : 'text-[#5D737E] hover:text-[#02111B]'
                    )}
                  >
                    Бүтээгдэхүүн
                  </Link>
                  <Link
                    href="/products"
                    className={cn(
                      'transition-colors font-light tracking-wide text-sm',
                      pathname?.startsWith('/products') ? 'text-[#02111B] font-normal' : 'text-[#5D737E] hover:text-[#02111B]'
                    )}
                  >
                    Ангилал
                  </Link>
                </nav>
              )}
            </div>

            {/* Right: Search + Actions */}
            <div className="flex items-center gap-3">
              {/* Desktop Search Bar (non-admin) */}
              {!isAdmin && (
                <div ref={searchRef} className="relative hidden sm:block">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[#02111B]/10 rounded-full hover:border-[#5D737E]/30 transition-colors">
                    <Search className="w-4 h-4 text-[#5D737E]" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Хайх..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      className="bg-transparent border-none outline-none text-sm text-[#02111B] placeholder:text-[#5D737E]/50 w-32 lg:w-48 font-light"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                        className="p-0.5 hover:bg-[#5D737E]/10 rounded-full transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-[#5D737E]" />
                      </button>
                    )}
                  </div>
                  {searchDropdownContent}
                </div>
              )}

              {/* Mobile Search Button (non-admin) */}
              {!isAdmin && (
                <button
                  onClick={() => {
                    setSearchFocused(true);
                    // Focus mobile input after render
                    setTimeout(() => mobileSearchInputRef.current?.focus(), 100);
                  }}
                  className="sm:hidden p-2 hover:bg-white rounded-full transition-colors"
                >
                  <Search className="w-5 h-5 text-[#02111B]" />
                </button>
              )}

              {/* User Icon */}
              {user ? (
                <>
                  {!isAdmin && (
                    <Link
                      href="/profile"
                      className="p-2 hover:bg-white rounded-full transition-colors"
                      title={user.name}
                    >
                      <User className="w-5 h-5 text-[#02111B]" />
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="p-2 hover:bg-white rounded-full transition-colors"
                    title="Гарах"
                  >
                    <LogOut className="w-5 h-5 text-[#3F4045]" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <User className="w-5 h-5 text-[#02111B]" />
                </button>
              )}

              {/* Cart (non-admin) */}
              {!isAdmin && (
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative p-2 hover:bg-white rounded-full transition-colors"
                >
                  <ShoppingCart className="w-5 h-5 text-[#02111B]" />
                  {mounted && itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#02111B] text-white rounded-full flex items-center justify-center text-xs font-medium">
                      {itemCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Panel (non-admin) */}
        {!isAdmin && mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#02111B]/5 bg-[#FCFCFC]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
              <nav className="flex flex-col gap-3">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'text-sm font-light tracking-wide transition-colors py-1',
                    pathname === '/' ? 'text-[#02111B] font-normal' : 'text-[#5D737E]'
                  )}
                >
                  Бүтээгдэхүүн
                </Link>
                <Link
                  href="/products"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'text-sm font-light tracking-wide transition-colors py-1',
                    pathname?.startsWith('/products') ? 'text-[#02111B] font-normal' : 'text-[#5D737E]'
                  )}
                >
                  Ангилал
                </Link>
              </nav>
            </div>
          </div>
        )}

        {/* Mobile Search Overlay (non-admin, when focused on small screens) */}
        {!isAdmin && searchFocused && (
          <div className="sm:hidden border-t border-[#02111B]/5 bg-[#FCFCFC] px-4 py-3">
            <div ref={mobileSearchRef} className="relative">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#02111B]/10 rounded-full">
                <Search className="w-4 h-4 text-[#5D737E] flex-shrink-0" />
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  placeholder="Хайх..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-[#02111B] placeholder:text-[#5D737E]/50 flex-1 font-light"
                  autoFocus
                />
                <button
                  onClick={() => { setSearchQuery(''); setSearchFocused(false); }}
                  className="p-1 hover:bg-[#5D737E]/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-[#5D737E]" />
                </button>
              </div>
              {searchDropdownContent}
            </div>
          </div>
        )}
      </header>

      {/* Admin Mobile Sidebar */}
      {isAdmin && mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-[#02111B]/40 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed top-0 right-0 h-full w-72 bg-[#FCFCFC] z-50 shadow-2xl lg:hidden transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-[#02111B]/5">
                <h2 className="text-sm font-medium text-[#02111B] tracking-tight">Цэс</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 hover:bg-[#5D737E]/10 rounded-full transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4 text-[#3F4045]" />
                </button>
              </div>
              <nav className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-1">
                  {adminNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'block px-4 py-2.5 text-sm rounded-xl transition-colors font-light tracking-wide',
                        pathname === item.href
                          ? 'bg-[#02111B] text-white font-normal'
                          : 'text-[#3F4045] hover:bg-[#5D737E]/10'
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>
              <div className="p-4 border-t border-[#02111B]/5">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-[#5D737E] hover:bg-[#5D737E]/10 rounded-xl font-light"
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
