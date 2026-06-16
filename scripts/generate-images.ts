/**
 * 为四下单词生成配图（SVG 卡片风格）
 * 使用 emoji + 彩色背景，适合小学生
 * 运行：pnpm tsx scripts/generate-images.ts
 */

import fs from "fs"
import path from "path"
import prompts from "./word-image-prompts.json"

const OUT_DIR = path.resolve(__dirname, "../public/images/words/4B")

// 颜色轮换（6 种背景色）
const COLORS = ["#E3F2FD", "#FFF3E0", "#E8F5E9", "#FCE4EC", "#F3E5F5", "#E0F7FA"]

// 简单词到 emoji 的映射（覆盖四下高频词）
const EMOJI_MAP: Record<string, string> = {
  doctor: "👨‍⚕️", fireman: "🧑‍🚒", farmer: "👨‍🌾", cook: "👨‍🍳",
  police: "👮", nurse: "👩‍⚕️", teacher: "👨‍🏫", driver: "🚗",
  father: "👨", mother: "👩", aunt: "👩", uncle: "👨", boy: "👦",
  worker: "👷", scientist: "🔬", painter: "🎨", writer: "✍️", postman: "📮",
  station: "🏢", restaurant: "🍽️", field: "🌾",
  fire: "🔥", night: "🌙", owl: "🦉", taxi: "🚕", bee: "🐝",
  letter: "✉️", brush: "🖌️", safe: "🛡️",
  laugh: "😄", sad: "😢", cry: "😢", angry: "😠", scared: "😨",
  excited: "🤩", worried: "😟", frown: "🙁", shout: "📢",
  gift: "🎁", surprised: "😮", model: "✈️", bang: "💥",
  opera: "🎭", cough: "🤧", better: "💊", feeling: "💭",
  talent: "⭐", act: "🎪", magic: "🪄", dancer: "💃", puzzle: "🧩",
  shine: "✨", win: "🏆", duck: "🦆", cock: "🐓",
  life: "🌱", seed: "🌱", earth: "🌍", root: "🌿", stem: "🌿",
  leaf: "🍃", sunflower: "🌻", wheat: "🌾", cotton: "☁️", mouse: "🐭",
  grain: "🌾", cabbage: "🥬", paper: "📄", dig: "⛏️", sleep: "😴",
  forest: "🌲", nature: "🌿", hunt: "🔍", keeper: "🧑‍✈️", student: "🧑‍🎓",
  event: "🎉", drama: "🎭", trip: "✈️", fair: "🎡", festival: "🎊",
  horn: "📯", raindrop: "💧", more: "➕", write: "✏️",
  culture: "🌍", note: "📝", vote: "🗳️", lovely: "💖",
  hour: "🕐", fall: "🍂", off: "↗️",
  skirt: "👗", shorts: "🩳", shirt: "👔", trousers: "👖",
  scarf: "🧣", sweater: "🧥", dress: "👗", party: "🎉",
  dressmaker: "🧵", Christmas: "🎄", same: "🔄", wrong: "❌",
  clever: "🧠", present: "🎁", whale: "🐋", uniform: "👔", robe: "👘",
  mountain: "🏔️", street: "🛣️", hit: "🎯", huge: "🐋",
  slowly: "🐢", miss: "💭", will: "📅", everything: "✨",
  anything: "❓", enough: "✅", end: "🏁", Mr: "🎩",
}

function generateSVG(wordId: string, word: string): string {
  const colorIndex = parseInt(wordId) % COLORS.length
  const bg = COLORS[colorIndex]
  const emoji = EMOJI_MAP[word.toLowerCase()] || "📖"

  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="24" fill="${bg}"/>
  <text x="128" y="120" font-size="80" text-anchor="middle" dominant-baseline="central">${emoji}</text>
  <text x="128" y="200" font-size="20" font-weight="bold" font-family="Arial, sans-serif" text-anchor="middle" fill="#333">${word}</text>
</svg>`
}

async function main() {
  console.log("========================================")
  console.log("  生成单词配图（SVG 卡片）")
  console.log("========================================\n")

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const entries = Object.entries(prompts as Record<string, { word: string; prompt: string }>)
  console.log(`共 ${entries.length} 个单词\n`)

  let created = 0
  let skipped = 0

  for (const [wordId, { word }] of entries) {
    const filePath = path.join(OUT_DIR, `${wordId}.svg`)

    if (fs.existsSync(filePath)) {
      skipped++
      continue
    }

    const svg = generateSVG(wordId, word)
    fs.writeFileSync(filePath, svg)
    console.log(`  ${wordId} ${word} → ✅`)
    created++
  }

  console.log(`\n========================================`)
  console.log(`  完成！新增 ${created}，跳过 ${skipped}`)
  console.log(`  目录：${OUT_DIR}`)
  console.log(`========================================`)
}

main().catch(e => console.error("失败:", e.message))
