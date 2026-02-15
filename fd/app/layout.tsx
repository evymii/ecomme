import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import AuthProvider from "@/components/providers/AuthProvider";
import ScrollToTop from "@/components/providers/ScrollToTop";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Az Souvenir",
  description: "Az Souvenir - Чанартай бүтээгдэхүүн",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn">
      <body className={inter.className}>
        <AuthProvider>
          <ScrollToTop />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
