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
  description: "Az Souvenir - Монгол гар урлалын бэлэг дурсгал, чанартай бүтээгдэхүүн. Бэлэг дурсгалын цуглуулга.",
  keywords: ["Az Souvenir", "бэлэг дурсгал", "Монгол", "гар урлал", "souvenir", "Mongolia"],
  metadataBase: new URL("https://www.az-souvenir.com"),
  openGraph: {
    title: "Az Souvenir - Монгол бэлэг дурсгалын дэлгүүр",
    description: "Монгол гар урлалын бэлэг дурсгал, чанартай бүтээгдэхүүн.",
    url: "https://www.az-souvenir.com",
    siteName: "Az Souvenir",
    locale: "mn_MN",
    type: "website",
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
