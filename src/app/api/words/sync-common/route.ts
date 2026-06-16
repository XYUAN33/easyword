import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
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
  return [...new Set(words)]
}

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

/**
 * POST /api/words/sync-common
 * body: { category: string }
 *
 * 将常用词同步到 Word 表（book="常用单词"），返回真实数据库 ID
 */
export async function POST(req: NextRequest) {
  try {
    const session = await (await import("@/lib/auth")).getSession()
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { category } = await req.json()
    if (!category) {
      return NextResponse.json({ error: "缺少 category" }, { status: 400 })
    }

    const unitName = CATEGORY_NAMES[category] || category
    const wordList = loadCategoryWords(category)
    if (wordList.length === 0) {
      return NextResponse.json({ error: "未找到该分类" }, { status: 404 })
    }

    // 批量翻译
    const meanings = await translateWords(wordList)

    // 逐个 upsert 到 Word 表
    const wordRecords = []
    for (const w of wordList) {
      const record = await prisma.word.upsert({
        where: {
          book_unit_word: {
            book: "常用单词",
            unit: unitName,
            word: w,
          },
        },
        update: {
          meaning: meanings[w] || "",
        },
        create: {
          book: "常用单词",
          unit: unitName,
          module: category,
          word: w,
          meaning: meanings[w] || "",
          phonetic: null,
          phrases: "[]",
          sentences: "[]",
        },
      })
      wordRecords.push(record)
    }

    return NextResponse.json({
      success: true,
      count: wordRecords.length,
      words: wordRecords.map((r) => ({
        id: r.id,
        word: r.word,
        meaning: r.meaning,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: "同步失败", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
