import { NextRequest, NextResponse } from "next/server"
import { verifyCode } from "@/lib/verify-code"
import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json()

    if (!phone || !code) {
      return NextResponse.json(
        { error: "手机号和验证码不能为空" },
        { status: 400 }
      )
    }

    // 验证验证码
    if (!verifyCode(phone, code)) {
      return NextResponse.json(
        { error: "验证码错误或已过期" },
        { status: 401 }
      )
    }

    // 查找或创建用户
    let user = await prisma.user.findUnique({ where: { phone } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          nickname: `小朋友${phone.slice(-4)}`,
        },
      })
    }

    // 创建 session
    await createSession({ userId: user.id, phone: user.phone })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    )
  }
}
