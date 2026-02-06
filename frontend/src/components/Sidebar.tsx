"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { clearAuthToken } from "@/lib/auth";

const navItems = [
  { href: "/", label: "总览", icon: "📊", gradient: "from-violet-500 to-purple-500" },
  { href: "/funds", label: "基金库", icon: "🔍", gradient: "from-blue-500 to-cyan-500" },
  { href: "/assets", label: "资产管理", icon: "💼", gradient: "from-emerald-500 to-teal-500" },
  { href: "/dashboard", label: "投资组合", icon: "📈", gradient: "from-orange-500 to-rose-500" },
  { href: "/trades", label: "交易记录", icon: "💸", gradient: "from-pink-500 to-rose-500" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname === "/login") {
    return null;
  }

  return (
    <>
      {/* 移动端汉堡菜单按钮 */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-lg border border-gray-200"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {mobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* 移动端遮罩 */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-50 to-white border-r border-gray-200 flex flex-col shadow-xl z-40 transition-transform duration-300 ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}>
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 bg-white/50 backdrop-blur-sm">
        <div className="mb-2">
          <h1 className="text-2xl font-black bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
            JAX VAULT
          </h1>
        </div>
        <p className="text-xs font-medium bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent">
          my alpha system
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`
                group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 no-underline hover:no-underline
                ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg shadow-${item.gradient.split('-')[1]}-200 scale-105`
                    : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-102"
                }
              `}
            >
              <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
              <span className={`${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gradient-to-t from-slate-50 to-transparent">
        <div className="text-xs">
          <button
            onClick={() => {
              clearAuthToken();
              router.replace("/login");
            }}
            className="w-full mb-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-600 hover:text-gray-800 hover:border-purple-300"
          >
            退出登录
          </button>
          <div className="text-gray-400 text-center mt-2 font-mono">v0.1.0</div>
        </div>
      </div>
    </aside>
    </>
  );
}


