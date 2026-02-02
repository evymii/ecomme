'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Package, Heart, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const menuItems = [
  { href: '/profile', label: 'Профайл', icon: User },
  { href: '/profile/orders', label: 'Захиалгууд', icon: Package },
  { href: '/profile/favorites', label: 'Зүрхэлсэн', icon: Heart },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <aside className="w-full md:w-64 bg-white rounded-lg p-3 md:p-6 h-fit">
      <div className="flex flex-col items-center mb-4 md:mb-6">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-200 rounded-full flex items-center justify-center mb-2 md:mb-3">
          <User className="w-6 h-6 md:w-8 md:h-8 text-gray-400" />
        </div>
        <p className="text-sm md:text-base font-medium">{user?.name || 'Зочин'}</p>
      </div>

      <nav className="space-y-1.5 md:space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-black text-white'
                  : 'hover:bg-gray-100'
              )}
            >
              <Icon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-xs md:text-base">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
        >
          <LogOut className="w-4 h-4 md:w-5 md:h-5" />
          <span className="text-xs md:text-base">Системээс гарах</span>
        </button>
      </nav>
    </aside>
  );
}
