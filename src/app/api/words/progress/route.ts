import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// 遗忘曲线间隔（天数）
const REVIEW_INTERVALS = [1, 3, 7, 15, 30, 60]

function getNextReviewDate(reviewCount: number): Date {
  const days = REVIEW_INTERVALS[Math.min(reviewCount, REVIEW_INTERVALS.length - 1)]
  const next = new Date()
  next.setDate(next.getDate() + days)
  return next
}

/**
 * POST /api/words/progress
 * body: { wordId: number, action: "correct" | "error" }
 *
 * correct: 完成排序（不论之前是否出错）→ 次数+1, 积分+1
 * error: 排序错误 → 次数+1, 错误+1
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { wordId, action } = await req.json()

    if (!wordId || !action) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    // 查找已有进度记录
    const existing = await prisma.userWordProgress.findUnique({
      where: { userId_wordId: { userId: session.userId, wordId } },
    })

    if (action === "correct") {
      // 排序正确：次数+1, 积分（正确次数）隐含在 reviewCount - errorCount 中
      if (existing) {
        await prisma.userWordProgress.update({
          where: { id: existing.id },
          data: {
            reviewCount: existing.reviewCount + 1,
            nextReview: getNextReviewDate(existing.reviewCount + 1),
            status: existing.reviewCount >= 4 ? "mastered" : "reviewing",
          },
        })
      } else {
        await prisma.userWordProgress.create({
          data: {
            userId: session.userId,
            wordId,
            reviewCount: 1,
            errorCount: 0,
            nextReview: getNextReviewDate(0),
            status: "learning",
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (action === "error") {
      // 排序错误：次数+1, 错误+1
      if (existing) {
        await prisma.userWordProgress.update({
          where: { id: existing.id },
          data: {
            reviewCount: existing.reviewCount + 1,
            errorCount: existing.errorCount + 1,
          },
        })
      } else {
        await prisma.userWordProgress.create({
          data: {
            userId: session.userId,
            wordId,
            reviewCount: 1,
            errorCount: 1,
            nextReview: getNextReviewDate(0),
            status: "learning",
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}
