/**
 * DeepSeek API 调用工具
 * 使用 OpenAI 兼容接口
 */

const API_KEY = process.env.DEEPSEEK_API_KEY || ""
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatResponse {
  choices: { message: { content: string } }[]
}

/**
 * 调用 DeepSeek Chat API
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
  }
): Promise<string> {
  if (!API_KEY || API_KEY === "sk-xxx") {
    throw new Error("DEEPSEEK_API_KEY 未配置")
  }

  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`DeepSeek API 错误: ${response.status} ${err}`)
  }

  const data: ChatResponse = await response.json()
  return data.choices[0]?.message?.content || ""
}
