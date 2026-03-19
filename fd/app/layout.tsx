import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import AuthProvider from "@/components/providers/AuthProvider";
import ScrollToTop from "@/components/providers/ScrollToTop";
import ClerkWrapper from "@/components/providers/ClerkWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Az Souvenir - Монгол бэлэг дурсгалын дэлгүүр",
    template: "%s | Az Souvenir",
  },
  description: "Бичиг хэрэг, бэлэг дурсгал, гар утасны дагалдах хэрэгсэл болон өдөр тутмын хэрэгцээт бараа бүтээгдэхүүнийг нэг дороос. Хурдан хүргэлт. Найдвартай баталгаа.",
  keywords: ["Az Souvenir", "бэлэг дурсгал", "Монгол", "гар урлал", "souvenir", "Mongolia"],
  metadataBase: new URL("https://www.az-souvenir.com"),
  openGraph: {
    title: "Az Souvenir - Монгол бэлэг дурсгалын дэлгүүр",
    description: "Бичиг хэрэг, бэлэг дурсгал, гар утасны дагалдах хэрэгсэл болон өдөр тутмын хэрэгцээт бараа бүтээгдэхүүнийг нэг дороос. Хурдан хүргэлт. Найдвартай баталгаа.",
    url: "https://www.az-souvenir.com",
    siteName: "Az Souvenir",
    locale: "mn_MN",
    type: "website",
    images: [
      {
        url: "https://www.az-souvenir.com/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Az Souvenir homepage preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Az Souvenir - Монгол бэлэг дурсгалын дэлгүүр",
    description: "Бичиг хэрэг, бэлэг дурсгал, гар утасны дагалдах хэрэгсэл болон өдөр тутмын хэрэгцээт бараа бүтээгдэхүүнийг нэг дороос. Хурдан хүргэлт. Найдвартай баталгаа.",
    images: ["https://www.az-souvenir.com/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkWrapper>
      <html lang="mn">
        <body className={inter.className}>
          <AuthProvider>
            <ScrollToTop />
            {children}
            <Toaster />
          </AuthProvider>
        </body>
      </html>
    </ClerkWrapper>
  );
}
