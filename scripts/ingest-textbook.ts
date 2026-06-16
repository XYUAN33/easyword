/**
 * 课文 Markdown 灌库脚本
 * 将 bookResources/ 下的课文 markdown 处理为向量，存入 Qdrant
 *
 * 使用方式：pnpm tsx scripts/ingest-textbook.ts
 */

import fs from "fs"
import path from "path"
import { getEmbeddings } from "../src/lib/embedding"
import { initCollection, upsertPoints, getCollectionInfo } from "../src/lib/vector-store"

// ==================== 配置 ====================

const BOOK_RESOURCES_DIR = path.join(process.cwd(), "bookResources")
const CHUNK_MAX_LENGTH = 500 // 每个 chunk 最大字符数
const CHUNK_OVERLAP = 50 // chunk 重叠字符数

// ==================== Markdown 解析 ====================

interface TextbookChunk {
  id: string
  book: string
  unit: string
  module: string
  content: string
  words: string[]
}

/**
 * 从文件名推断册别
 * 例：四下课文.md → 4B, 三上单词.md → 3A
 */
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

/**
 * 将课文 markdown 按单元/模块分块
 */
function chunkTextbook(
  content: string,
  book: string,
  filename: string
): TextbookChunk[] {
  const chunks: TextbookChunk[] = []
  const lines = content.split("\n")

  let currentUnit = ""
  let currentModule = ""
  let currentText = ""
  let chunkIndex = 0

  // 匹配单元标题（如 "# Unit 1", "## Unit 2"）
  const unitRegex = /^#+\s*Unit\s+(\d+)/i
  // 匹配模块/章节标题（如 "## 1 Listen and sing", "### Start up"）
  const moduleRegex = /^#+\s+\d+\s+|^#+\s+(Start up|Speed up|Fuel up|Hit it big|Get ready|Check it|Wrap up)/i

  for (const line of lines) {
    const unitMatch = line.match(unitRegex)
    const moduleMatch = line.match(moduleRegex)

    if (unitMatch) {
      // 保存之前的 chunk
      if (currentText.trim().length > 50) {
        chunks.push({
          id: `${book}-${filename}-${chunkIndex++}`,
          book,
          unit: currentUnit,
          module: currentModule,
          content: currentText.trim(),
          words: [],
        })
      }
      currentUnit = `Unit${unitMatch[1]}`
      currentModule = ""
      currentText = ""
    } else if (moduleMatch) {
      // 模块切换，保存之前的 chunk（如果够长）
      if (currentText.trim().length > 100) {
        chunks.push({
          id: `${book}-${filename}-${chunkIndex++}`,
          book,
          unit: currentUnit,
          module: currentModule,
          content: currentText.trim(),
          words: [],
        })
        currentText = ""
      }
      currentModule = line.replace(/^#+\s*/, "").trim().substring(0, 30)
    } else {
      // 过滤掉图片引用和空行
      if (line.trim().startsWith("![")) continue
      if (line.trim() === "") {
        currentText += "\n"
      } else {
        currentText += line + "\n"
      }
    }

    // 超长 chunk 自动切分
    if (currentText.length > CHUNK_MAX_LENGTH) {
      chunks.push({
        id: `${book}-${filename}-${chunkIndex++}`,
        book,
        unit: currentUnit,
        module: currentModule,
        content: currentText.trim(),
        words: [],
      })
      // 保留 overlap
      const words = currentText.split(/\s+/)
      const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 6))
      currentText = overlapWords.join(" ") + "\n"
    }
  }

  // 保存最后一个 chunk
  if (currentText.trim().length > 50) {
    chunks.push({
      id: `${book}-${filename}-${chunkIndex++}`,
      book,
      unit: currentUnit,
      module: currentModule,
      content: currentText.trim(),
      words: [],
    })
  }

  return chunks
}

/**
 * 从单词文件提取词汇列表
 */
function extractWords(content: string): Record<string, string[]> {
  const unitWords: Record<string, string[]> = {}
  let currentUnit = ""

  const lines = content.split("\n")
  const unitRegex = /^#+\s*Unit\s+(\d+)/i
  // 匹配 "word 中文释义" 格式
  const wordRegex = /^([a-zA-Z][a-zA-Z\s'-]*)\s+[一-鿿]/

  for (const line of lines) {
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

// ==================== 主流程 ====================

async function main() {
  console.log("========================================")
  console.log("  EasyWord 课文灌库脚本")
  console.log("========================================\n")

  // 1. 检查 Qdrant 连接
  console.log("1. 检查 Qdrant 连接...")
  try {
    const info = await getCollectionInfo()
    console.log(`   ✅ Qdrant 已连接，集合状态: ${info.status}`)
    if (info.pointsCount && info.pointsCount > 0) {
      console.log(`   ⚠️  集合中已有 ${info.pointsCount} 条数据`)
    }
  } catch (err) {
    console.error("   ❌ 无法连接 Qdrant，请确保 Qdrant 已启动")
    console.error("   运行: docker run -d --name qdrant -p 6333:6333 qdrant/qdrant")
    process.exit(1)
  }

  // 2. 初始化集合
  console.log("\n2. 初始化向量集合...")
  await initCollection()

  // 3. 读取 bookResources 目录
  console.log("\n3. 扫描课文文件...")
  const files = fs.readdirSync(BOOK_RESOURCES_DIR).filter((f) => f.endsWith(".md"))
  console.log(`   找到 ${files.length} 个文件: ${files.join(", ")}`)

  // 4. 分离课文文件和单词文件
  const textbookFiles = files.filter((f) => f.includes("课文"))
  const wordFiles = files.filter((f) => f.includes("单词"))

  // 5. 提取词汇
  console.log("\n4. 提取词汇表...")
  const allUnitWords: Record<string, Record<string, string[]>> = {} // book -> unit -> words
  for (const file of wordFiles) {
    const book = inferBookFromFilename(file)
    const content = fs.readFileSync(path.join(BOOK_RESOURCES_DIR, file), "utf-8")
    const unitWords = extractWords(content)
    allUnitWords[book] = unitWords
    const totalWords = Object.values(unitWords).flat().length
    console.log(`   ${file} (${book}): ${totalWords} 个单词`)
  }

  // 6. 处理课文文件
  console.log("\n5. 处理课文文件...")
  const allChunks: TextbookChunk[] = []

  for (const file of textbookFiles) {
    const book = inferBookFromFilename(file)
    const content = fs.readFileSync(path.join(BOOK_RESOURCES_DIR, file), "utf-8")
    const chunks = chunkTextbook(content, book, file)
    console.log(`   ${file} (${book}): ${chunks.length} 个分块`)

    // 关联词汇
    const bookWords = allUnitWords[book] || {}
    for (const chunk of chunks) {
      chunk.words = bookWords[chunk.unit] || []
    }

    allChunks.push(...chunks)
  }

  console.log(`\n   共 ${allChunks.length} 个分块待处理`)

  if (allChunks.length === 0) {
    console.log("没有找到有效的课文分块，请检查文件格式")
    process.exit(0)
  }

  // 7. 生成 Embedding
  console.log("\n6. 生成向量 Embedding...")
  const texts = allChunks.map((c) => c.content)
  const embeddings = await getEmbeddings(texts)
  console.log(`   ✅ 生成 ${embeddings.length} 个向量，维度: ${embeddings[0]?.length}`)

  // 8. 存入 Qdrant
  console.log("\n7. 存入 Qdrant...")
  const batchSize = 50
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize)
    const batchEmbeddings = embeddings.slice(i, i + batchSize)

    await upsertPoints(
      batch.map((chunk, j) => ({
        id: chunk.id,
        vector: batchEmbeddings[j],
        payload: {
          book: chunk.book,
          unit: chunk.unit,
          module: chunk.module,
          content: chunk.content,
          words: chunk.words,
          chunkIndex: i + j,
        },
      }))
    )

    console.log(`   已存入 ${Math.min(i + batchSize, allChunks.length)}/${allChunks.length}`)
  }

  // 9. 完成
  const finalInfo = await getCollectionInfo()
  console.log(`\n========================================`)
  console.log(`  ✅ 灌库完成！`)
  console.log(`  集合: ${finalInfo.pointsCount} 条数据`)
  console.log(`========================================`)
}

main().catch((err) => {
  console.error("灌库失败:", err)
  process.exit(1)
})
