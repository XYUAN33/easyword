import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { getEmbeddings } from "@/lib/embedding"
import { initCollection, upsertPoints, getCollectionInfo } from "@/lib/vector-store"

const BOOK_RESOURCES_DIR = path.join(process.cwd(), "bookResources")
const CHUNK_MAX_LENGTH = 500

interface TextbookChunk {
  id: string
  book: string
  unit: string
  module: string
  content: string
  words: string[]
}

function inferBookFromFilename(filename: string): string {
  const gradeMap: Record<string, string> = {
    "三上": "3A", "三下": "3B",
    "四上": "4A", "四下": "4B",
    "五上": "5A", "五下": "5B",
    "六上": "6A", "六下": "6B",
  }
  for (const [cn, code] of Object.entries(gradeMap)) {
    if (filename.includes(cn)) return code
  }
  return "unknown"
}

function chunkTextbook(content: string, book: string, filename: string): TextbookChunk[] {
  const chunks: TextbookChunk[] = []
  const lines = content.split("\n")
  let currentUnit = ""
  let currentModule = ""
  let currentText = ""
  let chunkIndex = 0

  const unitRegex = /^#+\s*Unit\s+(\d+)/i
  const moduleRegex = /^#+\s+\d+\s+|^#+\s+(Start up|Speed up|Fuel up|Hit it big|Get ready|Check it|Wrap up)/i

  for (const line of lines) {
    const unitMatch = line.match(unitRegex)
    const moduleMatch = line.match(moduleRegex)

    if (unitMatch) {
      if (currentText.trim().length > 50) {
        chunks.push({
          id: `${book}-${filename}-${chunkIndex++}`,
          book, unit: currentUnit, module: currentModule,
          content: currentText.trim(), words: [],
        })
      }
      currentUnit = `Unit${unitMatch[1]}`
      currentModule = ""
      currentText = ""
    } else if (moduleMatch) {
      if (currentText.trim().length > 100) {
        chunks.push({
          id: `${book}-${filename}-${chunkIndex++}`,
          book, unit: currentUnit, module: currentModule,
          content: currentText.trim(), words: [],
        })
        currentText = ""
      }
      currentModule = line.replace(/^#+\s*/, "").trim().substring(0, 30)
    } else {
      if (line.trim().startsWith("![")) continue
      currentText += (line.trim() === "" ? "\n" : line + "\n")
    }

    if (currentText.length > CHUNK_MAX_LENGTH) {
      chunks.push({
        id: `${book}-${filename}-${chunkIndex++}`,
        book, unit: currentUnit, module: currentModule,
        content: currentText.trim(), words: [],
      })
      const words = currentText.split(/\s+/)
      currentText = words.slice(-8).join(" ") + "\n"
    }
  }

  if (currentText.trim().length > 50) {
    chunks.push({
      id: `${book}-${filename}-${chunkIndex++}`,
      book, unit: currentUnit, module: currentModule,
      content: currentText.trim(), words: [],
    })
  }

  return chunks
}

function extractWords(content: string): Record<string, string[]> {
  const unitWords: Record<string, string[]> = {}
  let currentUnit = ""
  const unitRegex = /^#+\s*Unit\s+(\d+)/i
  const wordRegex = /^([a-zA-Z][a-zA-Z\s'-]*)\s+[一-鿿]/

  for (const line of content.split("\n")) {
    const unitMatch = line.match(unitRegex)
    if (unitMatch) {
      currentUnit = `Unit${unitMatch[1]}`
      if (!unitWords[currentUnit]) unitWords[currentUnit] = []
      continue
    }
    if (currentUnit) {
      const wordMatch = line.trim().match(wordRegex)
      if (wordMatch) {
        const word = wordMatch[1].trim().toLowerCase()
        if (word.length > 1 && !unitWords[currentUnit].includes(word)) {
          unitWords[currentUnit].push(word)
        }
      }
    }
  }
  return unitWords
}

export async function POST() {
  try {
    // 1. 初始化
    await initCollection()

    // 2. 扫描文件
    if (!fs.existsSync(BOOK_RESOURCES_DIR)) {
      return NextResponse.json({ error: "bookResources 目录不存在" }, { status: 400 })
    }

    const files = fs.readdirSync(BOOK_RESOURCES_DIR).filter((f) => f.endsWith(".md"))
    const textbookFiles = files.filter((f) => f.includes("课文"))
    const wordFiles = files.filter((f) => f.includes("单词"))

    if (textbookFiles.length === 0) {
      return NextResponse.json({ error: "未找到课文文件" }, { status: 400 })
    }

    // 3. 提取词汇
    const allUnitWords: Record<string, Record<string, string[]>> = {}
    for (const file of wordFiles) {
      const book = inferBookFromFilename(file)
      const content = fs.readFileSync(path.join(BOOK_RESOURCES_DIR, file), "utf-8")
      allUnitWords[book] = extractWords(content)
    }

    // 4. 处理课文
    const allChunks: TextbookChunk[] = []
    for (const file of textbookFiles) {
      const book = inferBookFromFilename(file)
      const content = fs.readFileSync(path.join(BOOK_RESOURCES_DIR, file), "utf-8")
      const chunks = chunkTextbook(content, book, file)
      const bookWords = allUnitWords[book] || {}
      for (const chunk of chunks) {
        chunk.words = bookWords[chunk.unit] || []
      }
      allChunks.push(...chunks)
    }

    if (allChunks.length === 0) {
      return NextResponse.json({ error: "未生成有效分块" }, { status: 400 })
    }

    // 5. 生成 Embedding
    const texts = allChunks.map((c) => c.content)
    const embeddings = await getEmbeddings(texts)

    // 6. 存入向量存储
    await upsertPoints(
      allChunks.map((chunk, i) => ({
        id: chunk.id,
        vector: embeddings[i],
        payload: {
          book: chunk.book,
          unit: chunk.unit,
          module: chunk.module,
          content: chunk.content,
          words: chunk.words,
          chunkIndex: i,
        },
      }))
    )

    // 7. 返回结果
    const info = await getCollectionInfo()
    return NextResponse.json({
      success: true,
      files: files.length,
      chunks: allChunks.length,
      vectors: info.pointsCount,
      provider: process.env.JINA_API_KEY ? "jina" : "tfidf",
    })
  } catch (err) {
    console.error("[Ingest] 灌库失败:", err)
    return NextResponse.json(
      { error: "灌库失败", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
