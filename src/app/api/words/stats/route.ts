import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

/**
 * GET /api/words/stats?book=4B&unit=Unit1
 * 返回每个单词的学习统计：次数、正确率、积分、下次复习时间
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const book = searchParams.get("book")
    const unit = searchParams.get("unit")

    if (!book || !unit) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    // 常用词：URL 传的是分类 key（如 "colors"），数据库存的是中文名（如 "颜色"）
    const CATEGORY_MAP: Record<string, string> = {
      verbs: "动词", adjectives: "形容词", adverbs: "副词",
      nouns: "名词", colors: "颜色", numbers: "数字", interjections: "感叹词",
    }
    const dbUnit = CATEGORY_MAP[unit] || unit

    // 获取该单元所有单词
    const words = await prisma.word.findMany({
      where: { book, unit: dbUnit },
      orderBy: { id: "asc" },
    })

    // 获取用户对这些单词的学习进度
    const wordIds = words.map((w) => w.id)
    const progressList = await prisma.userWordProgress.findMany({
      where: {
        userId: session.userId,
        wordId: { in: wordIds },
      },
    })
    const progressMap = new Map(progressList.map((p) => [p.wordId, p]))

    // 计算用户总积分（所有单词的正确次数之和）
    const allProgress = await prisma.userWordProgress.findMany({
      where: { userId: session.userId },
      select: { reviewCount: true, errorCount: true },
    })
    const totalPoints = allProgress.reduce(
      (sum, p) => sum + Math.max(0, p.reviewCount - p.errorCount),
      0
    )

    const now = Date.now()

    // 构建单词统计列表
    const wordStats = words.map((w) => {
      const p = progressMap.get(w.id)
      const totalCount = p?.reviewCount ?? 0
      const errorCount = p?.errorCount ?? 0
      const correctCount = Math.max(0, totalCount - errorCount)
      const correctRate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
      const points = correctCount

      // 计算下次复习时间
      let nextReviewText = ""
      if (p?.nextReview) {
        const diff = p.nextReview.getTime() - now
        if (diff <= 0) {
          nextReviewText = "待复习"
        } else {
          const hours = Math.ceil(diff / (1000 * 60 * 60))
          if (hours < 24) {
            nextReviewText = `${hours}小时`
          } else {
            const days = Math.ceil(hours / 24)
            nextReviewText = `${days}天`
          }
        }
      }

      return {
        id: w.id,
        word: w.word,
        meaning: w.meaning,
        phonetic: w.phonetic,
        audioUrl: w.audioUrl,
        totalCount,
        correctCount,
        errorCount,
        correctRate,
        points,
        nextReviewText,
        status: p?.status ?? "new",
      }
    })

    return NextResponse.json({
      totalPoints,
      words: wordStats,
    })
  } catch (err) {
    return NextResponse.json(
      { error: "获取失败", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
