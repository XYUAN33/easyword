/**
 * 为所有课本单词生成 SVG 配图
 * 从 SQLite 数据库读取单词，emoji + 彩色背景
 * 运行：node scripts/generate-all-images.js
 */
const Database = require("better-sqlite3")
const fs = require("fs")
const path = require("path")

const DB_PATH = "prisma/dev.db"
const OUT_BASE = "public/images/words"

const COLORS = ["#E3F2FD", "#FFF3E0", "#E8F5E9", "#FCE4EC", "#F3E5F5", "#E0F7FA", "#FFF8E1", "#E1F5FE"]

const EMOJI_MAP = {
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
  hello: "👋", hi: "👋", good: "👍", morning: "☀️", afternoon: "🌤️",
  name: "📛", cat: "🐱", dog: "🐶", bird: "🐦", fish: "🐟",
  school: "🏫", book: "📚", pen: "🖊️", pencil: "✏️", ruler: "📏",
  bag: "🎒", desk: "🪑", chair: "🪑", door: "🚪", window: "🪟",
  apple: "🍎", banana: "🍌", orange: "🍊", cake: "🎂", milk: "🥛",
  water: "💧", rice: "🍚", egg: "🥚", bread: "🍞", meat: "🥩",
  red: "🔴", blue: "🔵", green: "🟢", yellow: "🟡", white: "⚪", black: "⚫",
  one: "1️⃣", two: "2️⃣", three: "3️⃣", four: "4️⃣", five: "5️⃣",
  six: "6️⃣", seven: "7️⃣", eight: "8️⃣", nine: "9️⃣", ten: "🔟",
  big: "🐘", small: "🐭", hot: "🔥", cold: "❄️", new: "🆕",
  old: "👴", happy: "😊", love: "❤️", like: "👍", play: "⚽",
  run: "🏃", jump: "🦘", swim: "🏊", fly: "🦋", walk: "🚶",
  eat: "🍽️", drink: "🥤", see: "👀", hear: "👂", read: "📖",
  sing: "🎤", dance: "💃", draw: "🎨", make: "🔧", help: "🤝",
  thank: "🙏", sorry: "😔", please: "🙋", yes: "✅", no: "❌",
  friend: "👫", family: "👨‍👩‍👧‍👦", home: "🏠", house: "🏠", room: "🛏️",
  sun: "☀️", moon: "🌙", star: "⭐", cloud: "☁️", rain: "🌧️",
  tree: "🌳", flower: "🌸", grass: "🌱", animal: "🐾",
  car: "🚗", bus: "🚌", bike: "🚲", boat: "⛵", plane: "✈️",
  head: "🗣️", hand: "✋", foot: "🦶", eye: "👁️", ear: "👂",
  mouth: "👄", nose: "👃", face: "😊",
  time: "⏰", day: "📅", week: "📆", year: "🗓️",
  food: "🍕", fruit: "🍇", vegetable: "🥕",
  body: "🧍", clothes: "👚", toy: "🧸", game: "🎮",
  spring: "🌸", summer: "☀️", autumn: "🍂", winter: "⛄",
  birthday: "🎂", children: "🧒", baby: "👶",
  sit: "🪑", stand: "🧍", open: "📂", close: "🔒",
  up: "⬆️", down: "⬇️", left: "⬅️", right: "➡️",
  hat: "🎩", cap: "🧢", shoe: "👞", sock: "🧦",
  box: "📦", ball: "⚽", bell: "🔔", key: "🔑",
  picture: "🖼️", music: "🎵", story: "📜",
  first: "🥇", last: "🏁", next: "⏭️",
  monkey: "🐵", tiger: "🐯", lion: "🦁", elephant: "🐘",
  rabbit: "🐰", bear: "🐻", panda: "🐼", snake: "🐍",
  horse: "🐴", cow: "🐄", pig: "🐷", chicken: "🐔", sheep: "🐑",
  color: "🎨", number: "🔢",
  // 常用词 extra
  beautiful: "💐", wonderful: "🌟", fantastic: "🎉", amazing: "🤩",
  terrible: "😱", horrible: "💀", delicious: "😋", interesting: "🤔",
  important: "⭐", different: "🔄", difficult: "🏔️", expensive: "💎",
  quickly: "💨", carefully: "🔍", quietly: "🤫", loudly: "📢",
  always: "🔁", sometimes: "🔄", usually: "📋", never: "🚫",
  today: "📅", tomorrow: "🔮", yesterday: "⏮️", together: "👥",
  because: "🤔", before: "⏪", after: "⏩", between: "↔️",
  inside: "📥", outside: "🌳", around: "🔄",
  who: "❓", what: "❔", where: "📍", when: "🕐", why: "💭",
  how: "🔧", many: "🔢", much: "⚖️", very: "💯",
  about: "💬", each: "👆", other: "👥", some: "📦",
  animal: "🐾", answer: "💡", question: "❓", word: "📝",
  world: "🌍", country: "🗺️", city: "🏙️", town: "🏘️",
  computer: "💻", phone: "📱", watch: "⌚", camera: "📷",
  table: "🪑", chair: "🪑", bed: "🛏️", sofa: "🛋️",
}

function getEmoji(word) {
  const lower = word.toLowerCase()
  if (EMOJI_MAP[lower]) return EMOJI_MAP[lower]
  // Emoji by word length
  const len = lower.length
  if (len <= 3) return "⭐"
  if (len <= 5) return "📖"
  if (len <= 7) return "✨"
  return "🌟"
}

function generateSVG(wordId, word) {
  const colorIndex = parseInt(wordId) % COLORS.length
  const bg = COLORS[colorIndex]
  const emoji = getEmoji(word)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="24" fill="${bg}"/>
  <text x="128" y="110" font-size="72" text-anchor="middle" dominant-baseline="central">${emoji}</text>
  <text x="128" y="200" font-size="18" font-weight="bold" font-family="Arial, sans-serif" text-anchor="middle" fill="#333">${word}</text>
</svg>`
}

function main() {
  console.log("🎨 生成所有单词配图\n")

  const db = new Database(DB_PATH)
  const words = db.prepare("SELECT id, book, word FROM Word ORDER BY book, id").all()
  console.log(`共 ${words.length} 个单词\n`)

  let created = 0, skipped = 0
  const bookStats = {}

  for (const w of words) {
    const dir = path.join(OUT_BASE, w.book)
    if (!bookStats[w.book]) bookStats[w.book] = { created: 0, skipped: 0 }

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const filePath = path.join(dir, `${w.id}.svg`)
    if (fs.existsSync(filePath)) {
      skipped++
      bookStats[w.book].skipped++
      continue
    }

    const svg = generateSVG(w.id, w.word)
    fs.writeFileSync(filePath, svg)
    created++
    bookStats[w.book].skipped++
    // Show progress every 50
    if (created % 50 === 0) process.stdout.write(`\r  已生成 ${created}...`)
  }

  db.close()

  console.log(`\r  已生成 ${created}, 跳过 ${skipped}\n`)
  console.log("各册统计:")
  for (const [book, stats] of Object.entries(bookStats)) {
    console.log(`  ${book}: ${stats.created} new, ${stats.skipped} total`)
  }
  console.log("\n✅ 完成!")
}

main()
