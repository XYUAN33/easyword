import { NextResponse } from "next/server"
import { getCollectionInfo } from "@/lib/vector-store"

export async function GET() {
  try {
    const info = await getCollectionInfo()
    return NextResponse.json({
      qdrant: {
        connected: true,
        ...info,
      },
      embedding: {
        provider: process.env.JINA_API_KEY ? "jina" : "tfidf",
        model: process.env.JINA_EMBEDDING_MODEL || "jina-embeddings-v3",
      },
    })
  } catch {
    return NextResponse.json({
      qdrant: {
        connected: false,
        exists: false,
        pointsCount: 0,
        status: "disconnected",
      },
      embedding: {
        provider: process.env.JINA_API_KEY ? "jina" : "tfidf",
        model: process.env.JINA_EMBEDDING_MODEL || "jina-embeddings-v3",
      },
    })
  }
}
