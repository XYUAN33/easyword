import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const userId = session.userId

    // 并行查询所有统计
    const [
      totalWords,
      masteredWords,
      reviewingWords,
      learningWords,
      readingCount,
      recentProgress,
      recentReadings,
    ] = await Promise.all([
      // 总学习单词数
      prisma.userWordProgress.count({
        where: { userId },
      }),
      // 已掌握
      prisma.userWordProgress.count({
        where: { userId, status: "mastered" },
      }),
      // 复习中
      prisma.userWordProgress.count({
        where: { userId, status: "reviewing" },
      }),
      // 学习中
      prisma.userWordProgress.count({
        where: { userId, status: "learning" },
      }),
      // 阅读练习次数
      prisma.readingHistory.count({
        where: { userId },
      }),
      // 最近 7 天的学习记录
      prisma.userWordProgress.findMany({
        where: {
          userId,
          firstLearned: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { firstLearned: true },
        orderBy: { firstLearned: "asc" },
      }),
      // 最近的阅读记录
      prisma.readingHistory.findMany({
        where: { userId },
        select: {
          book: true,
          unit: true,
          score: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ])

    // 按日期统计学习数量
    const dailyCounts: Record<string, number> = {}
    for (const p of recentProgress) {
      const day = p.firstLearned.toISOString().split("T")[0]
      dailyCounts[day] = (dailyCounts[day] || 0) + 1
    }

    // 构建连续学习天数
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split("T")[0]
      if (dailyCounts[key]) {
        streak++
      } else if (i > 0) {
        break
      }
    }

    return NextResponse.json({
      totalWords,
      masteredWords,
      reviewingWords,
      learningWords,
      readingCount,
      streak,
      dailyCounts,
      recentReadings,
    })
  } catch {
    return NextResponse.json({ error: "查询失败" }, { status: 500 })
  }
}
