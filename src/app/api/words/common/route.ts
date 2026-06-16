import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { chatCompletion } from "@/lib/deepseek"

// 词性分类的中文名称映射
const CATEGORY_NAMES: Record<string, string> = {
  verbs: "动词",
  adjectives: "形容词",
  adverbs: "副词",
  nouns: "名词",
  colors: "颜色",
  numbers: "数字",
  interjections: "感叹词",
  function_words: "功能词",
}

// 忽略的分类（太基础，不需要背）
const SKIP_CATEGORIES = ["function_words", "proper_nouns"]

function loadCommonWords(): Record<string, string[]> {
  const configPath = path.join(process.cwd(), "config", "common-words.json")
  const raw = fs.readFileSync(configPath, "utf-8")
  const config = JSON.parse(raw)
  const result: Record<string, string[]> = {}
  for (const [key, val] of Object.entries(config)) {
    if (key.startsWith("_") || key === "skip_capitalized") continue
    if (SKIP_CATEGORIES.includes(key)) continue
    if (Array.isArray(val) && val.length > 0) {
      result[key] = [...new Set(val)] // 去重
    }
  }
  return result
}

// DeepSeek 批量翻译（限制每批 50 个词）
async function translateWords(words: string[]): Promise<Record<string, string>> {
  if (words.length === 0) return {}

  const batch = words.slice(0, 50)
  const prompt = `请将以下英文单词翻译成中文，每个单词给出最常用的一个中文释义。
严格按 JSON 格式输出，不要输出其他内容：
{"word1": "释义1", "word2": "释义2"}

单词列表：
${batch.join(", ")}`

  try {
    const response = await chatCompletion(
      [{ role: "user", content: prompt }],
      { temperature: 0.3, maxTokens: 2000 }
    )

    let jsonStr = response.trim()
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) jsonStr = match[1].trim()

    return JSON.parse(jsonStr)
  } catch {
    // 翻译失败返回空
    return {}
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category") // 可选：指定词性
    const translate = searchParams.get("translate") === "true" // 是否翻译

    const allWords = loadCommonWords()

    // 如果指定了词性，只返回该分类
    if (category && allWords[category]) {
      const words = allWords[category]
      let meanings: Record<string, string> = {}

      if (translate) {
        meanings = await translateWords(words)
      }

      return NextResponse.json({
        category,
        categoryName: CATEGORY_NAMES[category] || category,
        words: words.map((w) => ({
          word: w,
          meaning: meanings[w] || "",
        })),
      })
    }

    // 返回所有分类概览
    const categories = Object.entries(allWords).map(([key, words]) => ({
      key,
      name: CATEGORY_NAMES[key] || key,
      count: words.length,
    }))

    return NextResponse.json({ categories })
  } catch (err) {
    return NextResponse.json(
      { error: "获取失败", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
