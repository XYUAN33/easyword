import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import crypto from "crypto"

const AK = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID!
const SK = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET!
const APP = process.env.ALIBABA_CLOUD_TTS_APP_KEY!

function sign(p: Record<string, string>, s: string): string {
  const sorted = Object.keys(p).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join("&")
  return crypto.createHmac("sha1", `${s}&`).update(`GET&%2F&${encodeURIComponent(sorted)}`).digest("base64")
}

async function main() {
  const p: Record<string, string> = { Action: "CreateToken", AccessKeyId: AK, Format: "JSON", RegionId: "cn-shanghai", SignatureMethod: "HMAC-SHA1", SignatureNonce: crypto.randomUUID(), SignatureVersion: "1.0", Timestamp: new Date().toISOString().replace(/\.\d{3}Z/, "Z"), Version: "2019-02-28" }
  p.Signature = sign(p, SK)
  const q = Object.keys(p).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join("&")
  const r = await fetch(`https://nls-meta.cn-shanghai.aliyuncs.com/?${q}`)
  const d = await r.json()
  const token = d.Token.Id as string
  console.log("Token OK")

  const endpoints = [
    "https://nls-gateway.cn-shanghai.aliyuncs.com/rest/v1/tts",
    "https://nls-gateway.cn-shanghai.aliyuncs.com/api/v1/tts",
    "https://nls-gateway.cn-shanghai.aliyuncs.com/tts",
    "https://nls-gateway.cn-shanghai.aliyuncs.com/rest/v1/tts?appkey=" + APP,
  ]

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-NLS-Token": token },
        body: JSON.stringify({ appkey: APP, text: "hello", format: "mp3", sample_rate: 16000 }),
      })
      console.log(`${ep} -> ${res.status} ${res.headers.get("content-type")}`)
      if (res.status !== 200) {
        const t = await res.text()
        console.log(`  Body: ${t.substring(0, 200)}`)
      }
    } catch (e: any) {
      console.log(`${ep} -> ERROR: ${e.message}`)
    }
  }
}

main().catch(e => console.error("失败:", e.message))
