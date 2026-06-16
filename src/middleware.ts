import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "easyword-dev-secret-change-in-production"
)

// 需要登录的路径前缀
const PROTECTED_PATHS = ["/vocabulary", "/reading", "/review", "/history"]
// API 路径中需要登录的
const PROTECTED_API_PATHS = ["/api/words", "/api/reading"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 检查是否是需要保护的路径
  const isProtected =
    PROTECTED_PATHS.some((p) => pathname.startsWith(p)) ||
    PROTECTED_API_PATHS.some((p) => pathname.startsWith(p))

  if (!isProtected) return NextResponse.next()

  const token = req.cookies.get("easyword-session")?.value
  if (!token) {
    // 页面请求重定向到登录页，API 请求返回 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }

  try {
    await jwtVerify(token, SECRET)
    return NextResponse.next()
  } catch {
    // token 无效，清除 cookie 并重定向
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 })
    }
    const res = NextResponse.redirect(new URL("/login", req.url))
    res.cookies.delete("easyword-session")
    return res
  }
}

export const config = {
  matcher: [
    "/vocabulary/:path*",
    "/reading/:path*",
    "/review/:path*",
    "/history/:path*",
    "/api/words/:path*",
    "/api/reading/:path*",
  ],
}
