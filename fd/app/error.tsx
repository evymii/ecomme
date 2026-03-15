'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FCFCFC] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2
          className="text-2xl md:text-3xl text-[#02111B] tracking-tight mb-3"
          style={{ fontWeight: 600 }}
        >
          Алдаа гарлаа
        </h2>
        <p className="text-sm text-[#5D737E] font-light mb-6">
          Уучлаарай, ямар нэг зүйл буруу боллоо. Дахин оролдоно уу.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-[#02111B] text-white rounded-full text-sm font-light tracking-wide hover:bg-[#02111B]/90 transition-colors"
        >
          Дахин оролдох
        </button>
      </div>
    </div>
  );
}
