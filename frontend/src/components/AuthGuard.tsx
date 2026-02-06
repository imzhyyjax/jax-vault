"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";


export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") return;
    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
    }
  }, [pathname, router]);

  return <>{children}</>;
}

