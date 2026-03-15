import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FCFCFC] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1
          className="text-6xl md:text-8xl text-[#02111B] tracking-tight mb-4"
          style={{ fontWeight: 600 }}
        >
          404
        </h1>
        <h2
          className="text-xl md:text-2xl text-[#02111B] tracking-tight mb-3"
          style={{ fontWeight: 500 }}
        >
          Хуудас олдсонгүй
        </h2>
        <p className="text-sm text-[#5D737E] font-light mb-8">
          Таны хайсан хуудас байхгүй эсвэл зөөгдсөн байна.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-[#02111B] text-white rounded-full text-sm font-light tracking-wide hover:bg-[#02111B]/90 transition-colors"
        >
          Нүүр хуудас руу буцах
        </Link>
      </div>
    </div>
  );
}
