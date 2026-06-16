"use client";

import { useState } from "react";
import { Phone, KeyRound, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (phone.length < 11 || code.length < 6) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary"><img src="/单词icon.png" alt="" className="w-8 h-8 inline-block align-middle mr-1" /> EasyWord</h1>
          <p className="mt-2 text-muted-foreground">输入手机号开始学习</p>
        </div>

        {/* Login form */}
        <div className="space-y-4">
          {/* Phone input */}
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="tel"
              maxLength={11}
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Code input */}
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              maxLength={6}
              inputMode="numeric"
              placeholder="请输入验证码"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Dev mode hint */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-700 text-center">
              🧪 开发模式：验证码固定为 <span className="font-bold">123456</span>
            </p>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-error text-center">{error}</p>
          )}

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={phone.length < 11 || code.length < 6 || loading}
            className="w-full h-12 rounded-xl bg-primary text-white text-lg font-semibold transition-all hover:bg-primary-dark active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            登录
          </button>
        </div>
      </div>
    </div>
  );
}
