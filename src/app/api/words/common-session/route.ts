import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { chatCompletion } from "@/lib/deepseek"

const CATEGORY_NAMES: Record<string, string> = {
  verbs: "动词",
  adjectives: "形容词",
  adverbs: "副词",
  nouns: "名词",
  colors: "颜色",
  numbers: "数字",
  interjections: "感叹词",
}

function loadCategoryWords(category: string): string[] {
  const configPath = path.join(process.cwd(), "config", "common-words.json")
  const raw = fs.readFileSync(configPath, "utf-8")
  const config = JSON.parse(raw)
  const words = config[category]
  if (!Array.isArray(words)) return []
  return [...new Set(words)] // 去重
}

// DeepSeek 批量翻译
async function translateWords(words: string[]): Promise<Record<string, string>> {
  const prompt = `请将以下英文单词翻译成中文，每个单词给出最常用的1-2个中文释义。
严格按 JSON 格式输出，不要输出其他内容：
{"word1": "释义1", "word2": "释义2"}

单词列表：
${words.join(", ")}`

  try {
    const response = await chatCompletion(
      [{ role: "user", content: prompt }],
      { temperature: 0.3, maxTokens: 3000 }
    )
    let jsonStr = response.trim()
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) jsonStr = match[1].trim()
    return JSON.parse(jsonStr)
  } catch {
    return {}
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")

    if (!category) {
      return NextResponse.json({ error: "缺少 category 参数" }, { status: 400 })
    }

    const words = loadCategoryWords(category)
    if (words.length === 0) {
      return NextResponse.json({ error: "未找到该分类" }, { status: 404 })
    }

    // 调用 DeepSeek 翻译
    const meanings = await translateWords(words)

    // 构建单词列表（格式与 /api/words/list 兼容）
    const wordList = words.map((w, i) => ({
      id: 10000 + i, // 临时 ID
      word: w,
      meaning: meanings[w] || "",
      phonetic: null,
      phrases: [],
      sentences: [],
      progress: null,
      isCommon: true, // 标记为常用词
    }))

    return NextResponse.json({
      book: "常用单词",
      unit: CATEGORY_NAMES[category] || category,
      words: wordList,
    })
  } catch (err) {
    return NextResponse.json(
      { error: "获取失败", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
