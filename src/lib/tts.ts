/**
 * 阿里云语音合成 (TTS) 工具
 * 文档：https://help.aliyun.com/document_detail/84435.html
 *
 * 使用 Gateway REST API，无需额外 SDK
 */

import crypto from "crypto"

const ACCESS_KEY_ID = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || ""
const ACCESS_KEY_SECRET = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || ""
const APP_KEY = process.env.ALIBABA_CLOUD_TTS_APP_KEY || ""

// 音色配置
const VOICE_CONFIG = {
  en: process.env.TTS_VOICE_EN || "alloy",
  zh: process.env.TTS_VOICE_ZH || "xiaoyun",
}

/**
 * 阿里云 API 签名（HMAC-SHA1）
 */
function signRequest(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&")
  const stringToSign = `GET&${encodeURIComponent("/")}&${encodeURIComponent(sorted)}`
  const hmac = crypto.createHmac("sha1", secret + "&")
  hmac.update(stringToSign)
  return hmac.digest("base64")
}

/**
 * 获取阿里云 NLS Token
 */
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
  params.Signature = signRequest(params, ACCESS_KEY_SECRET)

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

/**
 * 调用阿里云 TTS 合成语音
 */
export async function synthesizeSpeech(
  text: string,
  options?: {
    lang?: "en" | "zh"
    voice?: string
    speed?: number   // 语速，范围 -500 ~ 500
    volume?: number  // 音量，范围 0 ~ 100
    pitch?: number   // 语调，范围 -500 ~ 500
  }
): Promise<Buffer> {
  if (!ACCESS_KEY_ID || !APP_KEY) {
    throw new Error("阿里云 TTS 未配置（ALIBABA_CLOUD_ACCESS_KEY_ID / APP_KEY）")
  }

  const lang = options?.lang || "en"
  const voice = options?.voice || VOICE_CONFIG[lang]
  const token = await getToken()

  const url = "https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/tts"
  const body = {
    appkey: APP_KEY,
    token: token,
    text: text,
    format: "mp3",
    sample_rate: 16000,
    voice: voice,
    volume: options?.volume ?? 50,
    speech_rate: options?.speed ?? 0,
    pitch_rate: options?.pitch ?? 0,
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`TTS 合成失败: ${response.status} ${err}`)
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("audio")) {
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  // 如果返回的是 JSON，说明出错了
  const errorData = await response.json()
  throw new Error(`TTS 返回错误: ${JSON.stringify(errorData)}`)
}

/**
 * 生成单词音频文件路径
 */
export function getWordAudioPath(wordId: number, word: string): string {
  // 文件名用 wordId 保证唯一性
  return `/audio/words/${wordId}.mp3`
}

/**
 * 检查 TTS 是否已配置
 */
export function isTTSConfigured(): boolean {
  return !!(ACCESS_KEY_ID && ACCESS_KEY_SECRET && APP_KEY)
}
