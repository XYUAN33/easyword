import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// 获取指定课本/单元的单词列表（含用户学习进度）
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const book = searchParams.get("book")
    const unit = searchParams.get("unit")

    if (!book) {
      return NextResponse.json({ error: "缺少 book 参数" }, { status: 400 })
    }

    const where: { book: string; unit?: string } = { book }
    if (unit) where.unit = unit

    const words = await prisma.word.findMany({
      where,
      orderBy: { id: "asc" },
      take: unit ? undefined : 200, // 全书最多返回 200 个
    })

    // 获取用户对这些单词的学习进度
    const wordIds = words.map((w) => w.id)
    const progress = await prisma.userWordProgress.findMany({
      where: {
        userId: session.userId,
        wordId: { in: wordIds },
      },
    })

    const progressMap = new Map(progress.map((p) => [p.wordId, p]))

    const result = words.map((w) => ({
      id: w.id,
      word: w.word,
      meaning: w.meaning,
      phonetic: w.phonetic,
      audioUrl: w.audioUrl,
      phrases: JSON.parse(w.phrases),
      sentences: JSON.parse(w.sentences),
      progress: progressMap.get(w.id) || null,
    }))

    return NextResponse.json({ words: result })
  } catch {
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 })
  }
}
