import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import crypto from "crypto"
import fs from "fs"

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

async function tryRequest(label: string, url: string, headers: Record<string, string>, body: any): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) })
    const ct = res.headers.get("content-type") || ""
    if (ct.includes("audio") || ct.includes("octet")) {
      const buf = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync("test-audio.mp3", buf)
      console.log(`✅ ${label}: ${res.status} audio ${buf.length} bytes`)
      return true
    } else {
      const text = (await res.text()).substring(0, 150)
      console.log(`❌ ${label}: ${res.status} ${text}`)
    }
  } catch (e: any) {
    console.log(`❌ ${label}: ERROR ${e.message}`)
  }
  return false
}

async function main() {
  const token = await getToken()
  console.log("Token:", token.substring(0, 10) + "...")
  console.log("AppKey:", APP)
  console.log("")

  const domains = [
    "nls-gateway.cn-shanghai.aliyuncs.com",
    "nls-gateway-cn-shanghai.aliyuncs.com",
  ]
  const paths = ["/rest/v1/tts", "/rest/v2/tts", "/stream/v1/tts"]
  const bodyBase = { text: "hello", format: "mp3", sample_rate: 16000, voice: "xiaoyun" }

  for (const domain of domains) {
    for (const path of paths) {
      const url = `https://${domain}${path}`
      // 方式1: X-NLS-Token header + appkey in body
      await tryRequest(`${domain}${path} [header+body]`, url,
        { "Content-Type": "application/json", "X-NLS-Token": token },
        { ...bodyBase, appkey: APP })

      // 方式2: X-NLS-Token header + appkey in URL
      await tryRequest(`${domain}${path}?appkey [header+url]`, `${url}?appkey=${APP}`,
        { "Content-Type": "application/json", "X-NLS-Token": token },
        bodyBase)

      // 方式3: token in body + appkey in body
      await tryRequest(`${domain}${path} [all-in-body]`, url,
        { "Content-Type": "application/json" },
        { ...bodyBase, appkey: APP, token: token })

      // 方式4: token in body + appkey in URL
      await tryRequest(`${domain}${path}?appkey [token-body]`, `${url}?appkey=${APP}`,
        { "Content-Type": "application/json" },
        { ...bodyBase, token: token })
    }
  }
}

main().catch(e => console.error("失败:", e.message))
