"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { loginUser, registerUser } from "@/lib/api";
import { setAuthToken, clearAuthToken } from "@/lib/auth";


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    clearAuthToken();
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("请输入邮箱和密码");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        await registerUser({ email: email.trim(), password });
      }
      const token = await loginUser({ email: email.trim(), password });
      setAuthToken(token.access_token);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-6 text-white">
          <h1 className="text-2xl font-bold">JAX VAULT</h1>
          <p className="text-sm opacity-90 mt-1">
            {mode === "login" ? "登录您的账户" : "创建一个新账户"}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">邮箱</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">密码</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              placeholder="至少 6 位"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              {mode === "login" ? "没有账户？注册" : "已有账户？登录"}
            </button>
          </div>
          <Button variant="primary" onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册并登录"}
          </Button>
        </div>
      </div>
    </div>
  );
}

