/**
 * Embedding 向量化工具
 * 默认使用 Jina AI 免费 Embedding API（支持中英文，1M tokens/月免费）
 * 可选：SiliconFlow、本地 TF-IDF 兜底
 */

const JINA_API_KEY = process.env.JINA_API_KEY || ""
const JINA_MODEL = process.env.JINA_EMBEDDING_MODEL || "jina-embeddings-v3"
const EMBEDDING_DIM = 1024 // jina-embeddings-v3 输出维度

interface EmbeddingResponse {
  data: { embedding: number[] }[]
}

/**
 * 调用 Jina AI Embedding API
 */
async function embedWithJina(texts: string[]): Promise<number[][]> {
  if (!JINA_API_KEY) {
    throw new Error("JINA_API_KEY 未配置")
  }

  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIM,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Jina API 错误: ${response.status} ${err}`)
  }

  const data: EmbeddingResponse = await response.json()
  return data.data.map((d) => d.embedding)
}

/**
 * 简单 TF-IDF 向量化（兜底方案，无需外部 API）
 * 将文本转为固定维度的稀疏向量，用于基本的语义匹配
 */
function embedWithTFIDF(texts: string[]): number[][] {
  // 构建词表
  const vocab = new Map<string, number>()
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "am", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "can",
    "could", "should", "may", "might", "must",
    "i", "you", "he", "she", "it", "we", "they",
    "in", "on", "at", "to", "for", "with", "from", "by", "of",
    "and", "but", "or", "not", "so", "if", "too",
    "this", "that", "these", "those",
  ])

  // 分词并构建词表
  const docsTokens: string[][] = texts.map((t) => {
    const tokens = (t.toLowerCase().match(/[a-zA-Z一-鿿]+/g) || [])
      .filter((w) => !stopWords.has(w) && w.length > 1)
    return tokens
  })

  for (const tokens of docsTokens) {
    for (const token of tokens) {
      if (!vocab.has(token)) {
        vocab.set(token, vocab.size)
      }
    }
  }

  // IDF 计算
  const df = new Map<string, number>()
  for (const tokens of docsTokens) {
    const seen = new Set(tokens)
    for (const token of seen) {
      df.set(token, (df.get(token) || 0) + 1)
    }
  }

  const n = texts.length
  const idf = new Map<string, number>()
  for (const [term, freq] of df) {
    idf.set(term, Math.log((n + 1) / (freq + 1)) + 1)
  }

  // 生成 TF-IDF 向量（降维到固定维度）
  return docsTokens.map((tokens) => {
    const tf = new Map<string, number>()
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1)
    }

    // 生成稀疏向量并哈希到固定维度
    const vec = new Array(EMBEDDING_DIM).fill(0)
    for (const [term, count] of tf) {
      const weight = (count / tokens.length) * (idf.get(term) || 1)
      // 哈希到固定维度
      let hash = 0
      for (let i = 0; i < term.length; i++) {
        hash = (hash * 31 + term.charCodeAt(i)) & 0x7fffffff
      }
      const idx = hash % EMBEDDING_DIM
      vec[idx] += weight
    }

    // 归一化
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
    return vec.map((v) => v / norm)
  })
}

/**
 * 生成文本向量（自动选择可用的 provider）
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  try {
    // 优先用 Jina
    if (JINA_API_KEY) {
      // Jina API 限制每次最多 100 条
      const results: number[][] = []
      for (let i = 0; i < texts.length; i += 100) {
        const batch = texts.slice(i, i + 100)
        const batchResult = await embedWithJina(batch)
        results.push(...batchResult)
      }
      return results
    }
  } catch (err) {
    console.warn("[Embedding] Jina 调用失败，使用本地 TF-IDF:", err)
  }

  // 兜底：本地 TF-IDF
  return embedWithTFIDF(texts)
}

/**
 * 生成单条文本向量
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const [vec] = await getEmbeddings([text])
  return vec
}

export { EMBEDDING_DIM }
