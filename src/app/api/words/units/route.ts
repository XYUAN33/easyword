import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 获取可用的课本和单元列表
export async function GET() {
  try {
    const units = await prisma.word.groupBy({
      by: ["book", "unit"],
      _count: { id: true },
      where: { book: { not: "常用单词" } }, // 排除常用词（前端单独处理）
      orderBy: [{ book: "asc" }, { unit: "asc" }],
    })

    // 按课本分组
    const books: Record<string, { unit: string; count: number }[]> = {}
    for (const u of units) {
      if (!books[u.book]) books[u.book] = []
      books[u.book].push({ unit: u.unit, count: u._count.id })
    }

    return NextResponse.json({ books })
  } catch {
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 })
  }
}
