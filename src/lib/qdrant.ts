/**
 * Qdrant 向量数据库工具
 */

import { QdrantClient } from "@qdrant/js-client-rest"
import { EMBEDDING_DIM } from "./embedding"

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333"
const COLLECTION_NAME = "textbook_content"

let client: QdrantClient | null = null

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: QDRANT_URL })
  }
  return client
}

/**
 * 初始化集合（如果不存在）
 */
export async function initCollection() {
  const qdrant = getQdrantClient()

  try {
    await qdrant.getCollection(COLLECTION_NAME)
    console.log(`[Qdrant] 集合 ${COLLECTION_NAME} 已存在`)
  } catch {
    console.log(`[Qdrant] 创建集合 ${COLLECTION_NAME}...`)
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: EMBEDDING_DIM,
        distance: "Cosine",
      },
    })
    console.log(`[Qdrant] 集合创建成功`)
  }
}

/**
 * 存储文档向量
 */
export async function upsertPoints(
  points: {
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
  }[]
) {
  const qdrant = getQdrantClient()

  await qdrant.upsert(COLLECTION_NAME, {
    points: points.map((p) => ({
      id: p.id,
      vector: p.vector,
      payload: p.payload,
    })),
  })
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
  const qdrant = getQdrantClient()
  const limit = options?.limit || 5

  // 构建过滤条件
  const must: any[] = []
  if (options?.book) {
    must.push({ key: "book", match: { value: options.book } })
  }
  if (options?.unit) {
    must.push({ key: "unit", match: { value: options.unit } })
  }

  const filter = must.length > 0 ? { must } : undefined

  const results = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    limit,
    filter,
    score_threshold: options?.scoreThreshold || 0.3,
    with_payload: true,
  })

  return results.map((r) => ({
    id: r.id,
    score: r.score,
    content: (r.payload as any)?.content || "",
    book: (r.payload as any)?.book || "",
    unit: (r.payload as any)?.unit || "",
    module: (r.payload as any)?.module || "",
    words: (r.payload as any)?.words || [],
  }))
}

/**
 * 获取集合信息
 */
export async function getCollectionInfo() {
  const qdrant = getQdrantClient()
  try {
    const info = await qdrant.getCollection(COLLECTION_NAME)
    return {
      exists: true,
      pointsCount: info.points_count,
      status: info.status,
    }
  } catch {
    return { exists: false, pointsCount: 0, status: "not_found" }
  }
}
