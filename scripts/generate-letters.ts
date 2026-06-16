/**
 * 生成 26 个英文字母的 MP3 音频
 * 运行：pnpm tsx scripts/generate-letters.ts
 */
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import crypto from "crypto"
import fs from "fs"
import path from "path"

const AK = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID!
const SK = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET!
const APP = process.env.ALIBABA_CLOUD_TTS_APP_KEY!
const VOICE = process.env.TTS_VOICE_EN || "siqi"

const OUT_DIR = path.resolve(__dirname, "../public/audio/letters")

async function getToken(): Promise<string> {
  const p: Record<string, string> = { Action: "CreateToken", AccessKeyId: AK, Format: "JSON", RegionId: "cn-shanghai", SignatureMethod: "HMAC-SHA1", SignatureNonce: crypto.randomUUID(), SignatureVersion: "1.0", Timestamp: new Date().toISOString().replace(/\.\d{3}Z/, "Z"), Version: "2019-02-28" }
  const sorted = Object.keys(p).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join("&")
  const sig = crypto.createHmac("sha1", `${SK}&`).update(`GET&%2F&${encodeURIComponent(sorted)}`).digest("base64")
  p.Signature = sig
  const q = Object.keys(p).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join("&")
  const r = await fetch(`https://nls-meta.cn-shanghai.aliyuncs.com/?${q}`)
  const d = await r.json()
  return d.Token.Id as string
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log("获取 Token...")
  const token = await getToken()
  console.log("Token OK\n")

  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    const filePath = path.join(OUT_DIR, `${letter}.mp3`)
    if (fs.existsSync(filePath)) {
      console.log(`  ${letter} → 已存在`)
      continue
    }

    const res = await fetch("https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-NLS-Token": token },
      body: JSON.stringify({
        appkey: APP,
        text: letter,
        format: "mp3",
        sample_rate: 16000,
        voice: VOICE,
        volume: 70,
        speech_rate: 0,
        pitch_rate: 0,
      }),
    })

    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(filePath, buf)
      console.log(`  ${letter} → ✅ ${buf.length} bytes`)
    } else {
      console.log(`  ${letter} → ❌ ${res.status}`)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n✅ 完成！字母音频保存在 ${OUT_DIR}`)
}

main().catch(e => console.error("失败:", e.message))
