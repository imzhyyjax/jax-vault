import "../globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "JAX-VAULT",
  description: "个人量化投资与组合管理系统",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "JAX-VAULT",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 text-gray-900 antialiased"
      >
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 md:ml-64 relative">
            {/* 背景装饰 */}
            <div className="fixed top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-200/30 via-pink-200/30 to-transparent rounded-full blur-3xl pointer-events-none"></div>
            <div className="fixed bottom-0 left-0 md:left-64 w-96 h-96 bg-gradient-to-tr from-blue-200/30 via-cyan-200/30 to-transparent rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative max-w-7xl mx-auto p-4 md:p-8 pt-16 md:pt-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}