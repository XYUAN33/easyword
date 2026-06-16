/**
 * 批量生成单词音频脚本
 * 为数据库中所有单词调用阿里云 TTS 生成 MP3
 *
 * 运行：pnpm tsx scripts/generate-audio.ts
 * 前提：.env.local 中配置了 ALIBABA_CLOUD_ACCESS_KEY_ID 等
 */

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import fs from "fs"
import path from "path"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

const adapter = new PrismaBetterSqlite3({
  url: "file:e:/coding/web/EasyWord/easyword/prisma/dev.db",
})
const prisma = new PrismaClient({ adapter })

const AUDIO_DIR = path.join(process.cwd(), "public", "audio", "words")

// 阿里云 TTS 配置
const ACCESS_KEY_ID = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || ""
const ACCESS_KEY_SECRET = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || ""
const APP_KEY = process.env.ALIBABA_CLOUD_TTS_APP_KEY || ""
const VOICE_EN = process.env.TTS_VOICE_EN || "alloy"

import crypto from "crypto"

function signRequest(params: Record<string, string>): string {
  // 1. 按参数名排序
  const sorted = Object.keys(params).sort().map(
    (k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  )
  const canonicalQuery = sorted.join("&")

  // 2. 构造待签名字符串
  const stringToSign = `GET&${encodeURIComponent("/")}&${encodeURIComponent(canonicalQuery)}`

  // 3. HMAC-SHA1 签名
  const hmac = crypto.createHmac("sha1", ACCESS_KEY_SECRET + "&")
  hmac.update(stringToSign)
  return hmac.digest("base64")
}

async function getToken(): Promise<string> {
  const params: Record<string, string> = {
    Action: "CreateToken",
    AccessKeyId: ACCESS_KEY_ID,
    Format: "JSON",
    RegionId: "cn-shanghai",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2019-02-28",
  }

  params.Signature = signRequest(params)

  const query = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&")

  const response = await fetch(`https://nls-meta.cn-shanghai.aliyuncs.com/?${query}`)
  const data = await response.json()

  if (data.Token && data.Token.Id) {
    return data.Token.Id
  }
  throw new Error(`获取 Token 失败: ${JSON.stringify(data)}`)
}

async function synthesize(text: string, token: string): Promise<Buffer> {
  const url = "https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/tts"
  const body = {
    appkey: APP_KEY,
    text: text,
    format: "mp3",
    sample_rate: 16000,
    voice: "xiaoyun",
    volume: 50,
    speech_rate: 0,
    pitch_rate: 0,
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-NLS-Token": token },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`TTS 失败: ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("audio")) {
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  const errorData = await response.json()
  throw new Error(`TTS 错误: ${JSON.stringify(errorData)}`)
}

async function main() {
  console.log("========================================")
  console.log("  批量生成单词音频")
  console.log("========================================\n")

  if (!ACCESS_KEY_ID || !APP_KEY) {
    console.error("❌ 请先在 .env.local 中配置阿里云 TTS：")
    console.error("   ALIBABA_CLOUD_ACCESS_KEY_ID=...")
    console.error("   ALIBABA_CLOUD_ACCESS_KEY_SECRET=...")
    console.error("   ALIBABA_CLOUD_TTS_APP_KEY=...")
    process.exit(1)
  }

  // 确保输出目录存在
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true })
  }

  // 获取所有单词
  const words = await prisma.word.findMany({
    where: { audioUrl: null }, // 只处理没有音频的单词
    orderBy: { id: "asc" },
  })

  console.log(`待处理单词：${words.length} 个\n`)

  if (words.length === 0) {
    console.log("✅ 所有单词已有音频，无需处理")
    process.exit(0)
  }

  // 获取 Token
  console.log("获取阿里云 Token...")
  const token = await getToken()
  console.log("Token 获取成功\n")

  let success = 0
  let failed = 0

  for (const word of words) {
    const audioFile = path.join(AUDIO_DIR, `${word.id}.mp3`)

    // 跳过已存在的音频文件
    if (fs.existsSync(audioFile)) {
      console.log(`  跳过 ${word.word}（音频已存在）`)
      await prisma.word.update({
        where: { id: word.id },
        data: { audioUrl: `/audio/words/${word.id}.mp3` },
      })
      success++
      continue
    }

    try {
      console.log(`  生成 ${word.word} ...`)
      const audio = await synthesize(word.word, token)
      fs.writeFileSync(audioFile, audio)

      // 更新数据库
      await prisma.word.update({
        where: { id: word.id },
        data: { audioUrl: `/audio/words/${word.id}.mp3` },
      })

      success++
      // 避免请求过快被限流
      await new Promise((r) => setTimeout(r, 200))
    } catch (err) {
      console.error(`  ❌ ${word.word}: ${err instanceof Error ? err.message : err}`)
      failed++
    }
  }

  console.log(`\n========================================`)
  console.log(`  完成！成功 ${success}，失败 ${failed}`)
  console.log(`  音频目录：${AUDIO_DIR}`)
  console.log(`========================================`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("脚本失败:", err)
  prisma.$disconnect()
  process.exit(1)
})
