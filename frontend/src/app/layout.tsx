import "../globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Jax Vault",
  description: "Personal Quant & Portfolio System",
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
          <main className="flex-1 ml-64 relative">
            {/* 背景装饰 */}
            <div className="fixed top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-200/30 via-pink-200/30 to-transparent rounded-full blur-3xl pointer-events-none"></div>
            <div className="fixed bottom-0 left-64 w-96 h-96 bg-gradient-to-tr from-blue-200/30 via-cyan-200/30 to-transparent rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative max-w-7xl mx-auto p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}