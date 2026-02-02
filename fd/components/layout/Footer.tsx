'use client';

export default function Footer() {
  return (
    <footer className="bg-white border-t mt-auto">
      <div className="container mx-auto px-4 py-3 md:py-4">
        <p className="text-xs text-gray-600 text-center">
          © {new Date().getFullYear()} Az Souvenir. Бүх эрх хуулиар хамгаалагдсан.
        </p>
      </div>
    </footer>
  );
}
