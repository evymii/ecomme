'use client';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-b from-transparent to-[#5D737E]/5 border-t border-[#02111B]/5 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="text-center space-y-3">
          <h2 className="text-[#02111B] tracking-tight font-semibold text-xl">
            Az
          </h2>
          <p className="text-[#5D737E] text-sm font-light">
            © {new Date().getFullYear()} Бүх эрх хуулиар хамгаалагдсан
          </p>
        </div>
      </div>
    </footer>
  );
}
