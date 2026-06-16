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

async function getToken(): Promise<string> {
  const p: Record<string, string> = { Action: "CreateToken", AccessKeyId: AK, Format: "JSON", RegionId: "cn-shanghai", SignatureMethod: "HMAC-SHA1", SignatureNonce: crypto.randomUUID(), SignatureVersion: "1.0", Timestamp: new Date().toISOString().replace(/\.\d{3}Z/, "Z"), Version: "2019-02-28" }
  p.Signature = sign(p, SK)
  const q = Object.keys(p).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join("&")
  const r = await fetch(`https://nls-meta.cn-shanghai.aliyuncs.com/?${q}`)
  const d = await r.json()
  return d.Token.Id as string
}

async function main() {
  const token = await getToken()
  const paths = ["/rest/v1/tts", "/rest/v1/tts/", "/tts", "/tts/", "/api/tts", "/v1/tts", "/rest/tts", "/v1/synthesis", "/rest/v1/synthesis"]
  for (const path of paths) {
    const res = await fetch(`https://nls-gateway.cn-shanghai.aliyuncs.com${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-NLS-Token": token },
      body: JSON.stringify({ appkey: APP, text: "hi", format: "mp3", sample_rate: 16000 }),
    })
    console.log(`${path} -> ${res.status}`)
    if (res.status !== 404) {
      console.log(`  ${(await res.text()).substring(0, 150)}`)
    }
  }
}

main().catch(e => console.error(e.message))
