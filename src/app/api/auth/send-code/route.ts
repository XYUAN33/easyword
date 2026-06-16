import { NextRequest, NextResponse } from "next/server"
import { generateCode, storeCode, canSendCode, markCodeSent } from "@/lib/verify-code"
import { sendSmsCode } from "@/lib/sms"

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()

    // 校验手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "请输入正确的手机号" },
        { status: 400 }
      )
    }

    // 检查是否在倒计时中
    if (!canSendCode(phone)) {
      return NextResponse.json(
        { error: "请60秒后再试" },
        { status: 429 }
      )
    }

    const code = generateCode()
    storeCode(phone, code)

    const sent = await sendSmsCode(phone, code)
    if (!sent) {
      return NextResponse.json(
        { error: "验证码发送失败，请稍后重试" },
        { status: 500 }
      )
    }

    markCodeSent(phone)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    )
  }
}
