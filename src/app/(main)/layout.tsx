"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brain, BookOpen, RotateCcw, BarChart3, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

const navItems = [
  { href: "/vocabulary", label: "背单词", icon: Brain },
  { href: "/reading", label: "阅读", icon: BookOpen },
  { href: "/review", label: "复习", icon: RotateCcw },
  { href: "/history", label: "进度", icon: BarChart3 },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  // 未登录时跳转到登录页
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // 加载中显示 loading
  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 未登录时不渲染内容（等待跳转）
  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* Top bar with user info */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between h-12 px-4 max-w-md mx-auto">
          <Link href="/" className="text-lg font-bold text-primary">
            <img src="/单词icon.png" alt="" className="w-6 h-6 inline-block align-middle mr-1" /> EasyWord
          </Link>
          {!loading && user && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {user.nickname}
              </span>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom navigation - mobile friendly */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
