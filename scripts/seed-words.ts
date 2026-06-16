/**
 * 词库导入脚本（支持多册教材）
 * 从 bookResources/ 下的所有 *单词.md 文件解析词汇并导入数据库
 * 运行: pnpm tsx scripts/seed-words.ts
 */
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { readFileSync, readdirSync } from "fs"
import { resolve, join } from "path"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

const adapter = new PrismaBetterSqlite3({
  url: "file:e:/coding/web/EasyWord/easyword/prisma/dev.db",
})
const prisma = new PrismaClient({ adapter })

const BOOK_DIR = resolve(__dirname, "../bookResources")

// 文件名 → 册别代码
function inferBook(filename: string): string {
  const map: Record<string, string> = {
    "三上": "3A", "三下": "3B",
    "四上": "4A", "四下": "4B",
    "五上": "5A", "五下": "5B",
    "六上": "6A", "六下": "6B",
  }
  for (const [cn, code] of Object.entries(map)) {
    if (filename.includes(cn)) return code
  }
  return "unknown"
}

interface WordEntry {
  word: string
  meaning: string
  unit: string
}

function parseWordFile(filePath: string): WordEntry[] {
  const content = readFileSync(filePath, "utf-8")
  const lines = content.split("\n")
  const words: WordEntry[] = []
  let currentUnit = ""
  let inWordSection = false

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // 检测进入 Words and expressions 区域
    if (line.match(/^#+ Words and expressions$/i)) {
      inWordSection = true
      continue
    }

    // 检测离开（遇到 Word list 或 Proper nouns 停止）
    if (inWordSection && line.match(/^#+ (Word list|Proper nouns|Words and expressions in plays)/i)) {
      break
    }

    if (!inWordSection) continue

    // 检测单元标题（# Unit X 或 ## Unit X 或 ## Welcome）
    const unitMatch = line.match(/^#+\s*Unit\s+(\d+)/i)
    if (unitMatch) {
      currentUnit = `Unit${unitMatch[1]}`
      continue
    }

    // 特殊章节（如 Welcome）
    const specialMatch = line.match(/^#+\s*(Welcome|Starter)/i)
    if (specialMatch) {
      currentUnit = specialMatch[1]
      continue
    }

    // 跳过标题行和空行
    if (!line || line.startsWith("#")) continue
    if (!currentUnit) continue

    // 解析单词行: "word 中文含义" 格式
    const wordMatch = line.match(/^([a-zA-Z][a-zA-Z\s.'\-()/*]*?)\s+([一-鿿（(].*)$/)
    if (wordMatch) {
      const word = wordMatch[1].trim()
        .replace(/\.$/, "")  // 去掉末尾句号
        .replace(/\s+/g, " ") // 合并空格
      const meaning = wordMatch[2].trim()

      // 过滤无效条目
      if (word.length <= 1) continue
      if (word.length > 30) continue
      if (word.startsWith("Write")) continue

      words.push({ word, meaning, unit: currentUnit })
    }
  }

  return words
}

async function main() {
  console.log("========================================")
  console.log("  EasyWord 多册词库导入")
  console.log("========================================\n")

  // 扫描所有单词文件
  const files = readdirSync(BOOK_DIR)
    .filter(f => f.includes("单词") && f.endsWith(".md"))
    .sort()

  console.log(`找到 ${files.length} 个单词文件:\n`)

  let grandTotal = 0

  for (const file of files) {
    const book = inferBook(file)
    const filePath = join(BOOK_DIR, file)
    const words = parseWordFile(filePath)

    // 按 Unit 统计
    const unitCounts: Record<string, number> = {}
    for (const w of words) {
      unitCounts[w.unit] = (unitCounts[w.unit] || 0) + 1
    }

    console.log(`📖 ${file} (${book}): ${words.length} 个单词`)
    console.log(`   单元: ${Object.entries(unitCounts).map(([u, c]) => `${u}(${c})`).join(", ")}`)

    // 只清空当前课本数据（保留其他册和常用词）
    await prisma.word.deleteMany({ where: { book } })

    // 批量插入
    let inserted = 0
    for (const w of words) {
      try {
        await prisma.word.create({
          data: {
            book,
            unit: w.unit,
            module: "default",
            word: w.word,
            meaning: w.meaning,
            phonetic: null,
            audioUrl: null,
            phrases: "[]",
            sentences: "[]",
          },
        })
        inserted++
      } catch {
        // 跳过重复
      }
    }
    console.log(`   ✅ 导入 ${inserted} 个\n`)
    grandTotal += inserted
  }

  // 最终统计
  const total = await prisma.word.count()
  const byBook = await prisma.word.groupBy({
    by: ["book"],
    _count: { id: true },
    orderBy: { book: "asc" },
  })

  console.log("========================================")
  console.log(`  ✅ 导入完成！本次导入 ${grandTotal} 个单词`)
  console.log(`  数据库总计 ${total} 个单词:`)
  for (const b of byBook) {
    console.log(`    ${b.book}: ${b._count.id} 个`)
  }
  console.log("========================================")

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("导入失败:", err)
  prisma.$disconnect()
  process.exit(1)
})
