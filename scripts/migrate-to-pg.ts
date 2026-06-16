/**
 * SQLite → PostgreSQL(Neon) 数据迁移脚本 (批量版)
 * 用法: npx tsx scripts/migrate-to-pg.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

const projectRoot = resolve(process.cwd())
config({ path: resolve(projectRoot, ".env.local") })

import Database from "better-sqlite3"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const SQLITE_PATH = resolve(projectRoot, "prisma/dev.db")

async function migrate() {
  console.log("📦 连接 SQLite...")
  const sqlite = new Database(SQLITE_PATH)

  console.log("🐘 连接 PostgreSQL (Neon)...")
  const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!
  console.log("   URL:", dbUrl.replace(/\/\/.*@/, "//***@"))

  const adapter = new PrismaPg({ connectionString: dbUrl })
  const pg = new PrismaClient({ adapter })

  try {
    // 1. Users - upsert (usually just 1-2 rows)
    console.log("\n📋 迁移 Users...")
    const users = sqlite.prepare("SELECT * FROM User").all() as any[]
    if (users.length > 0) {
      for (const u of users) {
        await pg.user.upsert({
          where: { id: u.id },
          create: { id: u.id, phone: u.phone, nickname: u.nickname,
            grade: u.grade, avatarUrl: u.avatarUrl,
            createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt) },
          update: {},
        })
      }
    }
    console.log(`  ✓ ${users.length} users`)

    // 2. Words - 批量 createMany
    console.log("📋 迁移 Words (712条，批量插入)...")
    const words = sqlite.prepare("SELECT * FROM Word").all() as any[]
    if (words.length > 0) {
      const batchSize = 50
      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize)
        await pg.word.createMany({
          data: batch.map((w: any) => ({
            id: w.id, book: w.book, unit: w.unit, module: w.module,
            word: w.word, meaning: w.meaning || "", phonetic: w.phonetic,
            audioUrl: w.audioUrl, phrases: w.phrases, sentences: w.sentences,
          })),
          skipDuplicates: true,
        })
        process.stdout.write(`\r  ... ${Math.min(i + batchSize, words.length)}/${words.length}`)
      }
      console.log(`\n  ✓ ${words.length} words`)
    }

    // 3. UserWordProgress - 批量
    console.log("📋 迁移 UserWordProgress...")
    const progress = sqlite.prepare("SELECT * FROM UserWordProgress").all() as any[]
    if (progress.length > 0) {
      const batchSize = 50
      for (let i = 0; i < progress.length; i += batchSize) {
        const batch = progress.slice(i, i + batchSize)
        await pg.userWordProgress.createMany({
          data: batch.map((p: any) => ({
            id: p.id, userId: p.userId, wordId: p.wordId,
            firstLearned: new Date(p.firstLearned),
            reviewCount: p.reviewCount,
            nextReview: new Date(p.nextReview),
            status: p.status, errorCount: p.errorCount || 0,
            updatedAt: new Date(p.updatedAt),
          })),
          skipDuplicates: true,
        })
      }
    }
    console.log(`  ✓ ${progress.length} records`)

    // 4. ReadingHistory - 批量
    console.log("📋 迁移 ReadingHistory...")
    const readings = sqlite.prepare("SELECT * FROM ReadingHistory").all() as any[]
    if (readings.length > 0) {
      for (const r of readings) {
        await pg.readingHistory.upsert({
          where: { id: r.id },
          create: { id: r.id, userId: r.userId, book: r.book, unit: r.unit,
            passage: r.passage, questions: r.questions,
            userAnswers: r.userAnswers, score: r.score,
            createdAt: new Date(r.createdAt) },
          update: {},
        })
      }
    }
    console.log(`  ✓ ${readings.length} records`)

    // 5. TextbookContent - 批量
    console.log("📋 迁移 TextbookContent...")
    const textbooks = sqlite.prepare("SELECT * FROM TextbookContent").all() as any[]
    if (textbooks.length > 0) {
      for (const t of textbooks) {
        await pg.textbookContent.upsert({
          where: { id: t.id },
          create: { id: t.id, book: t.book, unit: t.unit, module: t.module,
            title: t.title, content: t.content, words: t.words },
          update: {},
        })
      }
    }
    console.log(`  ✓ ${textbooks.length} records`)

    console.log("\n✅ 迁移完成!")
  } catch (err) {
    console.error("❌ 迁移失败:", err)
    throw err
  } finally {
    sqlite.close()
    await pg.$disconnect()
  }
}

migrate()
