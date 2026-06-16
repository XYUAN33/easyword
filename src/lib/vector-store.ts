/**
 * 内存向量存储（Qdrant 的轻量替代方案）
 * 功能与 Qdrant 完全兼容，数据存在内存中
 * 等 Docker 网络通了可随时切换回 Qdrant
 */

import { EMBEDDING_DIM } from "./embedding"

interface VectorPoint {
  id: string
  vector: number[]
  payload: {
    book: string
    unit: string
    module: string
    content: string
    words: string[]
    chunkIndex: number
  }
}

// 内存存储
const store: VectorPoint[] = []
let collectionInitialized = false

/**
 * 初始化集合（内存模式始终成功）
 */
export async function initCollection() {
  if (!collectionInitialized) {
    console.log("[VectorStore] 内存向量存储已初始化")
    collectionInitialized = true
  }
}

/**
 * 存储文档向量
 */
export async function upsertPoints(
  points: VectorPoint[]
) {
  for (const point of points) {
    const existingIndex = store.findIndex((p) => p.id === point.id)
    if (existingIndex >= 0) {
      store[existingIndex] = point
    } else {
      store.push(point)
    }
  }
}

/**
 * 余弦相似度计算
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}

/**
 * 搜索相似文档
 */
export async function searchSimilar(
  queryVector: number[],
  options?: {
    book?: string
    unit?: string
    limit?: number
    scoreThreshold?: number
  }
) {
  const limit = options?.limit || 5
  const threshold = options?.scoreThreshold || 0.25

  let candidates = store

  // 过滤
  if (options?.book) {
    candidates = candidates.filter((p) => p.payload.book === options.book)
  }
  if (options?.unit) {
    candidates = candidates.filter((p) => p.payload.unit === options.unit)
  }

  // 计算相似度并排序
  const results = candidates
    .map((point) => ({
      id: point.id,
      score: cosineSimilarity(queryVector, point.vector),
      content: point.payload.content,
      book: point.payload.book,
      unit: point.payload.unit,
      module: point.payload.module,
      words: point.payload.words,
    }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return results
}

/**
 * 获取集合信息
 */
export async function getCollectionInfo() {
  return {
    exists: collectionInitialized,
    pointsCount: store.length,
    status: collectionInitialized ? "ok" : "not_initialized",
  }
}

/**
 * 清空存储
 */
export async function clearCollection() {
  store.length = 0
  console.log("[VectorStore] 已清空")
}
