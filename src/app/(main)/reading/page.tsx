"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Loader2 } from "lucide-react"

interface UnitInfo {
  unit: string
  count: number
}

export default function ReadingPage() {
  const router = useRouter()
  const [books, setBooks] = useState<Record<string, UnitInfo[]>>({})
  const [selectedBook, setSelectedBook] = useState("")
  const [selectedUnit, setSelectedUnit] = useState("")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch("/api/words/units")
      .then((res) => res.json())
      .then((data) => {
        if (data.books) {
          setBooks(data.books)
          const firstBook = Object.keys(data.books)[0]
          if (firstBook) setSelectedBook(firstBook)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const startReading = async () => {
    if (!selectedBook || !selectedUnit) return
    setGenerating(true)
    router.push(`/reading/session?book=${selectedBook}&unit=${selectedUnit}`)
  }

  const currentUnits = books[selectedBook] || []

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center px-4 py-6">
      <header className="w-full max-w-md mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-accent" />
          阅读练习
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          根据课文内容生成阅读理解，练习英语阅读
        </p>
      </header>

      <div className="w-full max-w-md space-y-4">
        {/* 课本选择 */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <h3 className="font-semibold mb-3">选择课本</h3>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(books).map((book) => (
              <button
                key={book}
                onClick={() => {
                  setSelectedBook(book)
                  setSelectedUnit("")
                }}
                className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                  selectedBook === book
                    ? "border-accent bg-orange-50 text-accent"
                    : "border-border hover:border-accent hover:text-accent"
                }`}
              >
                {book}
              </button>
            ))}
          </div>
        </div>

        {/* 单元选择 */}
        {selectedBook && (
          <div className="p-4 rounded-xl bg-card border border-border">
            <h3 className="font-semibold mb-3">选择单元</h3>
            <div className="grid grid-cols-3 gap-2">
              {currentUnits.map((u) => (
                <button
                  key={u.unit}
                  onClick={() => setSelectedUnit(u.unit)}
                  className={`h-12 rounded-lg border text-sm font-medium transition-colors ${
                    selectedUnit === u.unit
                      ? "border-accent bg-orange-50 text-accent"
                      : "border-border hover:border-accent hover:text-accent"
                  }`}
                >
                  {u.unit}
                  <span className="block text-xs text-muted-foreground">
                    {u.count}词
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 开始按钮 */}
        <button
          onClick={startReading}
          disabled={!selectedUnit || generating}
          className="w-full h-12 rounded-xl bg-accent text-white text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              生成中...
            </>
          ) : selectedUnit ? (
            `开始阅读（${selectedUnit}）`
          ) : (
            "请先选择单元"
          )}
        </button>
      </div>
    </div>
  )
}
