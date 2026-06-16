/**
 * 使用阿里云通义万相 (DashScope) API 为所有单词生成 AI 配图
 * 模型: wan2.6-t2i (同步返回, ¥0.20/张, 首批50张免费)
 * 运行: node scripts/generate-ai-images.js [--book=3A] [--dry-run]
 */

require("dotenv").config({ path: ".env.local" })
const Database = require("better-sqlite3")
const fs = require("fs")
const path = require("path")

// ─── 配置 ───────────────────────────────────────────────
const API_KEY = process.env.ALIBABA_CLOUD_IMAGE_API_KEY
const API_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
const MODEL = "wan2.6-t2i"        // 同步 API, ¥0.20/张, 1024*1024
const SIZE = "1024*1024"          // 1:1 方形, 适合卡片
const DELAY_MS = 1200             // 请求间隔 (ms), DashScope 免费额度 QPS≈1
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 3000     // 重试基础延迟 (ms)

const DB_PATH = "prisma/dev.db"
const OUT_BASE = "public/images/words"

// 解析命令行参数
const args = process.argv.slice(2)
const argBook = args.find(a => a.startsWith("--book="))?.split("=")[1]
const dryRun = args.includes("--dry-run")

if (!API_KEY) {
  console.error("❌ 未设置 ALIBABA_CLOUD_IMAGE_API_KEY, 请检查 .env.local")
  process.exit(1)
}

// ─── 提示词生成 ──────────────────────────────────────────
// 中文 prompt: wan2.6 是阿里模型, 中文 prompt 对场景理解更准确

// 词性分类 → 针对性 prompt, 提升质量
const WORD_STYLE_MAP = {
  // 名词-动物: 可爱卡通动物
  _animals: new Set([
    "cat", "dog", "bird", "fish", "duck", "mouse", "rabbit", "monkey", "tiger", "lion",
    "elephant", "bear", "panda", "snake", "horse", "cow", "pig", "chicken", "sheep",
    "owl", "bee", "whale", "cock", "frog", "spider", "butterfly"
  ]),
  // 名词-食物
  _food: new Set([
    "apple", "banana", "orange", "cake", "milk", "water", "rice", "egg", "bread",
    "meat", "food", "fruit", "vegetable", "cabbage", "grain", "wheat", "cotton"
  ]),
  // 名词-人物
  _people: new Set([
    "doctor", "fireman", "farmer", "cook", "police", "nurse", "teacher", "driver",
    "father", "mother", "aunt", "uncle", "boy", "worker", "scientist", "painter",
    "writer", "postman", "dancer", "student", "friend", "baby", "children", "dressmaker"
  ]),
  // 名词-自然
  _nature: new Set([
    "sun", "moon", "star", "cloud", "rain", "tree", "flower", "grass", "forest",
    "mountain", "field", "earth", "seed", "root", "stem", "leaf", "sunflower",
    "spring", "summer", "autumn", "winter", "snow", "wind"
  ]),
  // 名词-物品/建筑
  _objects: new Set([
    "book", "pen", "pencil", "ruler", "bag", "desk", "chair", "door", "window",
    "computer", "phone", "camera", "picture", "box", "ball", "bell", "key",
    "car", "bus", "bike", "boat", "plane", "taxi", "gift", "toy", "hat", "cap",
    "shoe", "sock", "shirt", "skirt", "trousers", "dress", "scarf", "sweater",
    "school", "home", "house", "room", "station", "restaurant", "street", "city"
  ]),
  // 颜色
  _colors: new Set(["red", "blue", "green", "yellow", "white", "black", "color"]),
  // 数字
  _numbers: new Set(["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "number"]),
  // 动作
  _actions: new Set([
    "run", "jump", "swim", "fly", "walk", "eat", "drink", "see", "hear", "read",
    "sing", "dance", "draw", "make", "help", "sit", "stand", "open", "close",
    "play", "laugh", "cry", "sleep", "thank", "please", "write", "hit", "shout", "dig"
  ]),
}

function getWordCategory(word) {
  const lower = word.toLowerCase()
  const prefixMap = {
    _animals: "一只可爱的{cartoon}卡通动物，明亮的眼睛，圆润的造型",
    _food: "一份诱人的{cartoon}卡通食物，色彩鲜艳，看起来美味可口",
    _people: "一个可爱的{cartoon}卡通人物，友好微笑的表情，Q版造型",
    _nature: "一幅美丽的{cartoon}自然风景小插画，色彩柔和明亮",
    _objects: "一个可爱的{cartoon}卡通物品，圆润的造型，明亮的色彩",
    _colors: "一个{cartoon}色块和对应颜色物品的可爱插画，色彩鲜明",
    _numbers: "一个童趣的数字{cartoon}认知插画，带有对应数量的可爱小物品",
    _actions: "一个可爱的{cartoon}卡通小孩正在做动作的插画，动态活泼",
  }
  for (const [key, template] of Object.entries(prefixMap)) {
    if (WORD_STYLE_MAP[key]?.has(lower)) return template
  }
  // 默认: 通用概念插画
  return "一个可爱的{cartoon}卡通插画，色彩明亮温暖"
}

function buildPrompt(word) {
  const styleTemplate = getWordCategory(word)
  const style = styleTemplate.replace("{cartoon}", "")
  return `为英语单词"${word}"创作${style}，构图简洁清晰，适合6-12岁小学生英语单词卡片使用，白色或浅色简洁背景，画面中不要出现任何文字、字母或数字，纯图像`
}

// ─── API 调用 ────────────────────────────────────────────
async function callDashScope(prompt, retries = 0) {
  const body = {
    model: MODEL,
    input: {
      messages: [{ role: "user", content: [{ text: prompt }] }],
    },
    parameters: {
      prompt_extend: true,   // AI 智能扩写提示词, 提升画面质量
      watermark: false,
      size: SIZE,
      n: 1,
    },
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    // API 错误处理
    if (!res.ok || data.code) {
      const errMsg = data.message || data.code || `HTTP ${res.status}`
      throw new Error(`API Error: ${errMsg}`)
    }

    // 提取图片 URL
    const imageUrl = data?.output?.choices?.[0]?.message?.content?.find(c => c.image)?.image
    if (!imageUrl) {
      console.error("   ⚠ 响应无图片:", JSON.stringify(data).slice(0, 300))
      throw new Error("No image in response")
    }

    return imageUrl
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const wait = RETRY_DELAY_BASE * Math.pow(2, retries)
      console.log(`   🔄 重试 ${retries + 1}/${MAX_RETRIES}, 等待 ${wait / 1000}s...`)
      await sleep(wait)
      return callDashScope(prompt, retries + 1)
    }
    throw err
  }
}

async function downloadImage(url, filePath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(filePath, buffer)
}

// ─── 辅助 ────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

// ─── 主流程 ──────────────────────────────────────────────
async function main() {
  console.log("🎨 通义万相 AI 配图生成\n")
  console.log(`   模型: ${MODEL}`)
  console.log(`   尺寸: ${SIZE}`)
  console.log(`   间隔: ${DELAY_MS}ms/请求`)
  console.log(`   预估: ¥0.20/张 (首批50张免费)\n`)

  if (dryRun) {
    console.log("⚠ DRY RUN 模式 - 仅预览, 不实际生成\n")
  }

  const db = new Database(DB_PATH)
  let query = "SELECT id, book, word FROM Word"
  if (argBook) {
    query += " WHERE book = ?"
  }
  query += " ORDER BY book, id"
  const words = argBook ? db.prepare(query).all(argBook) : db.prepare(query).all()
  db.close()

  console.log(`共 ${words.length} 个单词${argBook ? ` (${argBook})` : ""}\n`)

  // 统计已存在的
  let existing = 0
  for (const w of words) {
    const filePath = path.join(OUT_BASE, w.book, `${w.id}.png`)
    if (fs.existsSync(filePath)) existing++
  }
  const remaining = words.length - existing
  console.log(`已存在: ${existing}, 待生成: ${remaining}\n`)
  if (remaining === 0) {
    console.log("✅ 全部已生成, 无需重复生成")
    return
  }

  if (dryRun) {
    // 预览前 10 个提示词
    console.log("─── 提示词预览 (前10个) ───\n")
    for (let i = 0; i < Math.min(10, words.length); i++) {
      const w = words[i]
      const prompt = buildPrompt(w.word)
      console.log(`[${w.book}] ${w.word.padEnd(16)} → ${prompt}\n`)
    }
    return
  }

  // ─── 正式生成 ────────────────────────────────────────
  let generated = 0
  let failed = 0
  let skipped = 0
  let totalCost = 0
  const startTime = Date.now()
  const failures = []

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const dir = path.join(OUT_BASE, w.book)
    const filePath = path.join(dir, `${w.id}.png`)

    // 跳过已存在的
    if (fs.existsSync(filePath)) {
      skipped++
      continue
    }

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const prompt = buildPrompt(w.word)
    const progress = `[${i + 1}/${words.length}]`
    const elapsed = formatDuration(Date.now() - startTime)

    try {
      console.log(`${progress} 🖼  [${w.book}] ${w.word}`)
      console.log(`        📝 ${prompt.slice(0, 80)}...`)

      const imageUrl = await callDashScope(prompt)
      await downloadImage(imageUrl, filePath)

      generated++
      totalCost += 0.20 // ¥0.20 per image

      // 检查文件大小
      const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(1)
      console.log(`        ✅ 已保存 (${sizeKB} KB) | 耗时 ${elapsed} | 已生成 ${generated}`)

      // 免费额度提示
      if (generated === 50) {
        console.log(`        💡 已用完首批50张免费额度, 后续按 ¥0.20/张 计费`)
      }
    } catch (err) {
      failed++
      failures.push({ book: w.book, word: w.word, id: w.id, error: err.message })
      console.error(`        ❌ 失败: ${err.message}`)
      // 清理可能的不完整文件
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }

    // 请求间隔 (最后一个不等待)
    if (i < words.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  // ─── 统计 ────────────────────────────────────────────
  const totalTime = Date.now() - startTime
  console.log("\n" + "=".repeat(60))
  console.log("📊 生成统计")
  console.log("=".repeat(60))
  console.log(`   ✅ 新生成:   ${generated}`)
  console.log(`   ⏭  跳过:     ${skipped}`)
  console.log(`   ❌ 失败:     ${failed}`)
  console.log(`   💰 预估费用: ¥${totalCost.toFixed(1)} (首批50张免费则 -¥10)`)
  console.log(`   ⏱  总耗时:   ${formatDuration(totalTime)}`)
  console.log("=".repeat(60))

  if (failures.length > 0) {
    console.log(`\n⚠ 失败列表 (${failures.length}):`)
    for (const f of failures) {
      console.log(`   [${f.book}] ${f.word} (id=${f.id}): ${f.error}`)
    }
    // 保存失败列表方便重跑
    const failFile = "scripts/failed-images.json"
    fs.writeFileSync(failFile, JSON.stringify(failures, null, 2))
    console.log(`\n   失败列表已保存至 ${failFile}`)
  }

  console.log("\n✅ 完成!")
}

main().catch(err => {
  console.error("❌ 致命错误:", err)
  process.exit(1)
})
