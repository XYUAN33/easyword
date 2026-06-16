import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// 艾宾浩斯复习间隔（小时）：1天, 2天, 4天, 7天, 15天, 30天
const REVIEW_INTERVALS_HOURS = [24, 48, 96, 168, 360, 720]

/**
 * 根据复习次数计算下次复习时间
 */
function calcNextReview(reviewCount: number): Date {
  // 超过最大间隔则使用最后一档（30天）
  const index = Math.min(reviewCount, REVIEW_INTERVALS_HOURS.length - 1)
  const hours = REVIEW_INTERVALS_HOURS[index]
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

/**
 * GET: 获取待复习的单词列表
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "20", 10)

    // 查询 nextReview <= now 的单词
    const dueWords = await prisma.userWordProgress.findMany({
      where: {
        userId: session.userId,
        status: { not: "mastered" },
        nextReview: { lte: new Date() },
      },
      include: {
        word: {
          select: {
            id: true,
            word: true,
            meaning: true,
            phonetic: true,
            book: true,
            unit: true,
            phrases: true,
            sentences: true,
          },
        },
      },
      orderBy: { nextReview: "asc" },
      take: limit,
    })

    // 也查一下已掌握但到了长期复习时间的单词
    const masteredDue = await prisma.userWordProgress.findMany({
      where: {
        userId: session.userId,
        status: "mastered",
        nextReview: { lte: new Date() },
      },
      include: {
        word: {
          select: {
            id: true,
            word: true,
            meaning: true,
            phonetic: true,
            book: true,
            unit: true,
            phrases: true,
            sentences: true,
          },
        },
      },
      orderBy: { nextReview: "asc" },
      take: 5,
    })

    const allWords = [...dueWords, ...masteredDue]

    // 解析 JSON 字段
    const formatted = allWords.map((p) => ({
      progressId: p.id,
      wordId: p.word.id,
      word: p.word.word,
      meaning: p.word.meaning,
      phonetic: p.word.phonetic,
      book: p.word.book,
      unit: p.word.unit,
      phrases: JSON.parse(p.word.phrases),
      sentences: JSON.parse(p.word.sentences),
      reviewCount: p.reviewCount,
      status: p.status,
      nextReview: p.nextReview,
    }))

    return NextResponse.json({
      total: formatted.length,
      words: formatted,
    })
  } catch {
    return NextResponse.json({ error: "查询失败" }, { status: 500 })
  }
}

/**
 * POST: 标记单词已复习，更新下次复习时间
 * body: { wordId: number, remembered: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { wordId, remembered } = await req.json()

    if (!wordId || typeof remembered !== "boolean") {
      return NextResponse.json({ error: "参数错误" }, { status: 400 })
    }

    const progress = await prisma.userWordProgress.findUnique({
      where: {
        userId_wordId: {
          userId: session.userId,
          wordId,
        },
      },
    })

    if (!progress) {
      return NextResponse.json({ error: "未找到学习记录" }, { status: 404 })
    }

    let newReviewCount = progress.reviewCount
    let newStatus = progress.status

    if (remembered) {
      // 记住了：增加复习次数
      newReviewCount = progress.reviewCount + 1
      // 复习 5 次以上标记为 mastered
      if (newReviewCount >= 5) {
        newStatus = "mastered"
      } else if (newStatus === "learning") {
        newStatus = "reviewing"
      }
    } else {
      // 没记住：重置复习进度
      newReviewCount = 0
      newStatus = "learning"
    }

    const nextReview = calcNextReview(newReviewCount)

    await prisma.userWordProgress.update({
      where: { id: progress.id },
      data: {
        reviewCount: newReviewCount,
        status: newStatus,
        nextReview,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      wordId,
      reviewCount: newReviewCount,
      status: newStatus,
      nextReview,
    })
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}
