import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { chatCompletion } from "@/lib/deepseek"
import { getEmbedding } from "@/lib/embedding"
import { searchSimilar, getCollectionInfo } from "@/lib/vector-store"

// ==================== 加载白名单配置 ====================

function loadCommonWords(): { words: Set<string>; skipCapitalized: boolean } {
  const configPath = path.join(process.cwd(), "config", "common-words.json")
  try {
    const raw = fs.readFileSync(configPath, "utf-8")
    const config = JSON.parse(raw)
    const allWords: string[] = []
    for (const [key, val] of Object.entries(config)) {
      if (key.startsWith("_")) continue
      if (key === "skip_capitalized") continue
      if (Array.isArray(val)) allWords.push(...val)
    }
    return {
      words: new Set(allWords),
      skipCapitalized: config.skip_capitalized !== false,
    }
  } catch {
    console.warn("[Config] 无法加载 common-words.json，使用空列表")
    return { words: new Set(), skipCapitalized: true }
  }
}

const { words: COMMON_WORDS, skipCapitalized: SKIP_CAPITALIZED } = loadCommonWords()

// 单元主题映射
const UNIT_THEMES: Record<string, string> = {
  Unit1: "jobs and workplaces (doctor, farmer, cook, nurse, driver, etc.)",
  Unit2: "feelings and emotions (happy, sad, angry, excited, scared, etc.)",
  Unit3: "talents and abilities (dancing, singing, painting, magic, etc.)",
  Unit4: "plants and nature (seeds, roots, leaves, flowers, etc.)",
  Unit5: "school events and activities (art festival, field trip, fair, etc.)",
  Unit6: "clothes and fashion (T-shirt, dress, skirt, trousers, uniform, etc.)",
}

// ==================== RAG 检索 ====================

async function retrieveContext(
  book: string,
  unit: string,
  query: string
): Promise<string> {
  try {
    // 检查 Qdrant 是否可用
    const info = await getCollectionInfo()
    if (!info.exists || info.pointsCount === 0) {
      return ""
    }

    // 生成查询向量
    const queryVector = await getEmbedding(query)

    // 搜索相关课文片段（同单元优先，也搜全局）
    const results = await searchSimilar(queryVector, {
      book,
      limit: 5,
      scoreThreshold: 0.25,
    })

    if (results.length === 0) return ""

    // 构建上下文
    const context = results
      .map((r) => `[${r.book} ${r.unit} ${r.module}] ${r.content}`)
      .join("\n\n---\n\n")

    return context
  } catch (err) {
    console.warn("[RAG] 检索失败，跳过:", err)
    return ""
  }
}

interface ReadingResult {
  passage: string
  questions: {
    question: string
    options: string[]
    correct: number
    explanation: string
  }[]
}

// ==================== DeepSeek 生成 ====================

function buildPrompt(
  book: string,
  unit: string,
  words: string[],
  ragContext: string
): string {
  const theme = UNIT_THEMES[unit] || "general English topics"
  const grade = book.replace(/[AB]$/, "").replace(/^(\d)/, "grade $1")
  const wordList = words.join(", ")

  let prompt = `你是一位经验丰富的小学英语老师。请为${grade}学生生成一篇阅读理解练习。

【要求】
1. 短文主题：${theme}
2. 短文长度：80-150个英文单词
3. 语言难度：只能使用以下词汇白名单中的单词，不能出现白名单以外的实词
4. 短文要有趣、贴近小学生生活
5. 出4道单选题（每题4个选项），题目考察对短文的理解
6. 每道题附上中文解析`

  // RAG 上下文
  if (ragContext) {
    prompt += `

【参考课文内容】
以下是教材中的相关课文片段，请参考这些内容的风格和主题来生成短文：
${ragContext}`
  }

  prompt += `

【词汇白名单】
${wordList}

【输出格式】严格输出以下JSON格式，不要输出任何其他内容：
{
  "passage": "英文短文内容...",
  "questions": [
    {
      "question": "英文问题",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correct": 0,
      "explanation": "中文解析"
    }
  ]
}`

  return prompt
}

async function generateWithDeepSeek(
  book: string,
  unit: string,
  words: string[],
  ragContext: string
): Promise<ReadingResult> {
  const prompt = buildPrompt(book, unit, words, ragContext)

  const response = await chatCompletion(
    [{ role: "user", content: prompt }],
    { temperature: 0.7, maxTokens: 2000 }
  )

  // 提取 JSON（处理可能的 markdown 代码块包裹）
  let jsonStr = response.trim()
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  }

  const result = JSON.parse(jsonStr)

  // 基本校验
  if (!result.passage || !Array.isArray(result.questions) || result.questions.length < 3) {
    throw new Error("AI 返回格式不正确")
  }

  // 校验每道题的格式
  for (const q of result.questions) {
    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error("题目格式不正确")
    }
    if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3) {
      q.correct = 0 // 修正无效的正确答案索引
    }
    if (!q.explanation) {
      q.explanation = "请查看正确答案。"
    }
  }

  return result as ReadingResult
}

// ==================== 词汇白名单校验 ====================

function validateVocabulary(passage: string, whitelist: string[]): {
  valid: boolean
  unknownWords: string[]
} {
  const whitelistSet = new Set(whitelist.map((w) => w.toLowerCase()))
  const words = passage.match(/[a-zA-Z]+/g) || []
  const unknownWords: string[] = []

  for (const word of words) {
    const lower = word.toLowerCase()
    if (lower.length <= 2) continue
    if (COMMON_WORDS.has(lower)) continue
    if (whitelistSet.has(lower)) continue
    if (whitelistSet.has(word)) continue
    if (SKIP_CAPITALIZED && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) continue

    const stems = [
      lower.replace(/ies$/, "y"),
      lower.replace(/ves$/, "f"),
      lower.replace(/ses$/, "s"),
      lower.replace(/es$/, ""),
      lower.replace(/s$/, ""),
      lower.replace(/ied$/, "y"),
      lower.replace(/ed$/, ""),
      lower.replace(/ing$/, ""),
      lower.replace(/ly$/, ""),
      lower.replace(/er$/, ""),
      lower.replace(/est$/, ""),
    ]
    if (stems.some((s) => COMMON_WORDS.has(s) || whitelistSet.has(s))) continue
    unknownWords.push(word)
  }

  const unique = [...new Set(unknownWords)]
  return { valid: unique.length <= 5, unknownWords: unique }
}

// ==================== Mock 兜底数据 ====================

function generateMockReading(
  book: string,
  unit: string,
  words: string[]
): ReadingResult {
  const passages: Record<string, ReadingResult> = {
    Unit1: {
      passage: `My name is Tom. I am a student. My father is a doctor. He works at a hospital. My mother is a nurse. She helps sick people every day. My uncle is a farmer. He works in the field. My aunt is a cook. She works in a restaurant. I want to be a scientist when I grow up.`,
      questions: [
        { question: "What does Tom's father do?", options: ["He is a nurse.", "He is a doctor.", "He is a farmer.", "He is a cook."], correct: 1, explanation: "文中说 'My father is a doctor.'，Tom 的爸爸是医生。" },
        { question: "Where does Tom's mother work?", options: ["In a restaurant.", "In a field.", "At a hospital.", "In a school."], correct: 2, explanation: "Tom 的妈妈是护士（nurse），在医院工作。" },
        { question: "What does Tom want to be?", options: ["A cook.", "A farmer.", "A doctor.", "A scientist."], correct: 3, explanation: "文中说 'I want to be a scientist when I grow up.'" },
        { question: "Who works in a restaurant?", options: ["Tom's father.", "Tom's mother.", "Tom's aunt.", "Tom's uncle."], correct: 2, explanation: "文中说 'My aunt is a cook. She works in a restaurant.'" },
      ],
    },
    Unit2: {
      passage: `Amy is very excited. She has a Beijing opera show with Lingling. But the next day, Amy is ill. She is coughing and she can't talk. She is very sad. Lingling is worried about Amy. A month later, Amy feels better. She is happy again. They practise very hard and do a great job!`,
      questions: [
        { question: "How does Amy feel at first?", options: ["She is sad.", "She is angry.", "She is excited.", "She is scared."], correct: 2, explanation: "文中说 'Amy is very excited.'" },
        { question: "Why can't Amy take part in the show?", options: ["She is angry.", "She is ill.", "She is scared.", "She is tired."], correct: 1, explanation: "文中说 'Amy is ill. She is coughing.'" },
        { question: "How does Lingling feel about Amy?", options: ["She is angry.", "She is happy.", "She is worried.", "She is scared."], correct: 2, explanation: "文中说 'Lingling is worried about Amy.'" },
        { question: "What happens at the end?", options: ["Amy is still ill.", "They do a great job.", "They don't practise.", "Lingling is sad."], correct: 1, explanation: "最后 Amy 好了，她们做得很好。" },
      ],
    },
    Unit3: {
      passage: `There is a talent show at school. Lingling is the best dancer. She dances very well. But she doesn't have beautiful clothes. She is worried. Daming says, "Don't worry. Talent is more important than clothes." Lingling practises every day. She wins the show!`,
      questions: [
        { question: "What is Lingling good at?", options: ["Singing.", "Dancing.", "Painting.", "Running."], correct: 1, explanation: "文中说 'Lingling is the best dancer.'" },
        { question: "Why is Lingling worried?", options: ["She can't dance.", "She is ill.", "She doesn't have beautiful clothes.", "She is scared."], correct: 2, explanation: "文中说 'She doesn't have beautiful clothes.'" },
        { question: "What does Daming tell Lingling?", options: ["She should give up.", "Talent is more important than clothes.", "She needs new clothes.", "She should not dance."], correct: 1, explanation: "Daming 说才华比衣服更重要。" },
        { question: "What happens at the end?", options: ["Lingling doesn't dance.", "Lingling wins the show.", "Lingling is sad.", "Daming dances."], correct: 1, explanation: "Lingling 赢了比赛。" },
      ],
    },
    Unit4: {
      passage: `Sam has some seeds. He wants to make a small garden. He plants tomato seeds and bean seeds. Two weeks later, the other seeds are growing. But Sam's sunflower seeds are not growing. The teacher says, "These seeds can't grow!" Sam is sad but he doesn't give up. He plants a new seed.`,
      questions: [
        { question: "What does Sam want to do?", options: ["He wants to cook.", "He wants to make a garden.", "He wants to be a scientist.", "He wants to draw."], correct: 1, explanation: "文中说 'He wants to make a small garden.'" },
        { question: "Why don't Sam's seeds grow?", options: ["He doesn't water them.", "They are not real seeds.", "It's too cold.", "He plants them too deep."], correct: 1, explanation: "老师说这些种子不能生长。" },
        { question: "What does Sam do after that?", options: ["He cries.", "He gives up.", "He plants a new seed.", "He goes home."], correct: 2, explanation: "Sam 没有放弃，他种了一颗新种子。" },
        { question: "What is the story about?", options: ["Cooking.", "Animals.", "Growing plants.", "Playing."], correct: 2, explanation: "这个故事是关于种植物的。" },
      ],
    },
    Unit5: {
      passage: `Today is the School Fair. There are many things to see. Daming is looking at the art. Lingling has a painting with horns and dots. In the forest, the students find a baby bird. It falls off the tree! They call the forest keeper. He puts the baby bird back in the nest. Everyone is happy!`,
      questions: [
        { question: "What event is happening?", options: ["Sports Day.", "The School Fair.", "Music Week.", "Book Week."], correct: 1, explanation: "文中说 'Today is the School Fair.'" },
        { question: "What does Lingling have?", options: ["A book.", "A song.", "A painting.", "A dance."], correct: 2, explanation: "Lingling 有一幅画。" },
        { question: "What happens to the baby bird?", options: ["It flies away.", "It falls off the tree.", "It sings.", "It is very big."], correct: 1, explanation: "小鸟从树上掉了下来。" },
        { question: "Who helps the bird?", options: ["The teacher.", "The forest keeper.", "Daming.", "Lingling."], correct: 1, explanation: "森林管理员把小鸟放回了鸟巢。" },
      ],
    },
    Unit6: {
      passage: `Tom is a dressmaker. He makes clothes for animals. A cat needs a dress. Tom makes a beautiful red dress for her. Eight little ducks come. They all look the same! Tom makes T-shirts with their names. Now they look different. Tom is a very clever dressmaker!`,
      questions: [
        { question: "What does Tom do?", options: ["He is a cook.", "He is a doctor.", "He is a dressmaker.", "He is a teacher."], correct: 2, explanation: "Tom 是裁缝。" },
        { question: "What does Tom make for the cat?", options: ["A hat.", "A red dress.", "A T-shirt.", "A coat."], correct: 1, explanation: "Tom 为猫做了一条红裙子。" },
        { question: "What is Tom's idea for the ducks?", options: ["He makes them hats.", "He makes T-shirts with names.", "He makes them shoes.", "He paints them."], correct: 1, explanation: "Tom 做了写有名字的 T 恤。" },
        { question: "How is Tom?", options: ["He is lazy.", "He is sad.", "He is clever.", "He is angry."], correct: 2, explanation: "Tom 是个聪明的裁缝。" },
      ],
    },
  }

  return (
    passages[unit] || {
      passage: `This is a story about ${UNIT_THEMES[unit] || "interesting things"}. We learn many new words in English. Learning English is fun!`,
      questions: [
        { question: "What is this story about?", options: ["Food.", "Animals.", "Learning English.", "School."], correct: 2, explanation: "这个故事是关于学英语的。" },
        { question: "What can we do?", options: ["Play games.", "Learn new words.", "Cook food.", "Sleep."], correct: 1, explanation: "我们可以学习新单词。" },
      ],
    }
  )
}

// ==================== API 路由 ====================

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const book = searchParams.get("book")
    const unit = searchParams.get("unit")

    if (!book || !unit) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    // 获取该册别所有已学词汇（当前单元及之前的单元）
    const words = await prisma.word.findMany({
      where: { book },
      select: { word: true, unit: true },
    })
    // 只使用当前单元及之前单元的词汇
    const unitNum = parseInt(unit.replace("Unit", ""), 10) || 99
    const wordList = words
      .filter((w) => {
        const wNum = parseInt(w.unit.replace("Unit", ""), 10) || 0
        return wNum <= unitNum
      })
      .map((w) => w.word)

    let result: ReadingResult
    let source: "ai" | "mock" = "mock"

    // RAG 检索相关课文内容
    const theme = UNIT_THEMES[unit] || ""
    const ragQuery = `${theme} ${wordList.slice(0, 10).join(" ")}`
    const ragContext = await retrieveContext(book, unit, ragQuery)

    if (ragContext) {
      console.log(`[RAG] 检索到课文上下文 (${ragContext.length} 字符)`)
    }

    // 尝试 DeepSeek 生成
    try {
      result = await generateWithDeepSeek(book, unit, wordList, ragContext)
      // 词汇白名单校验
      const validation = validateVocabulary(result.passage, wordList)
      if (!validation.valid) {
        console.warn(
          `[AI] 短文含超纲词(${validation.unknownWords.length}个):`,
          validation.unknownWords.join(", ")
        )
        // 超纲词太多则重试一次
        result = await generateWithDeepSeek(book, unit, wordList, ragContext)
        const retry = validateVocabulary(result.passage, wordList)
        if (!retry.valid) {
          console.warn("[AI] 重试后仍有超纲词，使用 mock 数据")
          result = generateMockReading(book, unit, wordList)
        } else {
          source = "ai"
        }
      } else {
        source = "ai"
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn("[AI] DeepSeek 调用失败，使用 mock 数据:", msg)
      result = generateMockReading(book, unit, wordList)
    }

    return NextResponse.json({
      book,
      unit,
      source,
      passage: result.passage,
      questions: result.questions,
    })
  } catch {
    return NextResponse.json({ error: "生成失败" }, { status: 500 })
  }
}
