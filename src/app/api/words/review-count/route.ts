import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ count: 0 })
    }

    const now = new Date()
    const count = await prisma.userWordProgress.count({
      where: {
        userId: session.userId,
        nextReview: { lte: now },
        status: { not: "mastered" },
      },
    })

    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
