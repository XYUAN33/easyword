"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Brain, Loader2, Trophy } from "lucide-react"

interface UnitInfo {
  unit: string
  count: number
}

interface CategoryInfo {
  key: string
  name: string
  count: number
}

interface WordStat {
  id: number
  word: string
  meaning: string
  phonetic: string | null
  totalCount: number
  correctCount: number
  errorCount: number
  correctRate: number
  points: number
  nextReviewText: string
  status: string
}

export default function VocabularyPage() {
  const router = useRouter()
  const [books, setBooks] = useState<Record<string, UnitInfo[]>>({})
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [selectedBook, setSelectedBook] = useState("")
  const [selectedUnit, setSelectedUnit] = useState("")
  const [loading, setLoading] = useState(true)

  // 单词统计
  const [wordStats, setWordStats] = useState<WordStat[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set())
  const [allSelected, setAllSelected] = useState(true)
  const [mode, setMode] = useState<"sort" | "fill" | "zh2en" | "en2zh">("sort")

  // 加载课本列表 + 常用词分类
  useEffect(() => {
    Promise.all([
      fetch("/api/words/units").then((r) => r.json()),
      fetch("/api/words/common").then((r) => r.json()),
    ])
      .then(([unitsData, commonData]) => {
        if (unitsData.books) setBooks(unitsData.books)
        if (commonData.categories) setCategories(commonData.categories)
        const firstBook = Object.keys(unitsData.books || {})[0]
        if (firstBook) setSelectedBook(firstBook)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // 加载单词统计
  const loadStats = useCallback(async (book: string, unit: string) => {
    if (!book || !unit) return
    setStatsLoading(true)
    try {
      const isCommon = book === "常用单词"

      if (isCommon) {
        // 常用词：先同步到数据库，再用 stats API 获取统计
        await fetch("/api/words/sync-common", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: unit }),
        })
      }

      // 统一使用 stats API（常用词同步后也有数据库记录了）
      const statsUrl = `/api/words/stats?book=${encodeURIComponent(book)}&unit=${encodeURIComponent(unit)}`
      const res = await fetch(statsUrl)
      const data = await res.json()

      if (data.words) {
        setWordStats(data.words)
        setTotalPoints(data.totalPoints ?? 0)
        setSelectedWordIds(new Set(data.words.map((w: WordStat) => w.id)))
        setAllSelected(true)
      }
    } catch (e) {
      console.error("加载统计失败:", e)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // 选择课本
  const selectBook = (book: string) => {
    setSelectedBook(book)
    setSelectedUnit("")
    setWordStats([])
    setSelectedWordIds(new Set())
  }

  // 选择单元
  const selectUnit = (unit: string) => {
    setSelectedUnit(unit)
    loadStats(selectedBook, unit)
  }

  // 全选/全不选
  const toggleAll = () => {
    if (allSelected) {
      setSelectedWordIds(new Set())
    } else {
      setSelectedWordIds(new Set(wordStats.map((w) => w.id)))
    }
    setAllSelected(!allSelected)
  }

  // 切换单个单词选择
  const toggleWord = (id: number) => {
    setSelectedWordIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 开始背诵
  const startLearning = () => {
    if (selectedWordIds.size === 0 || !selectedUnit) return
    const ids = Array.from(selectedWordIds).join(",")
    router.push(
      `/vocabulary/session?book=${selectedBook}&unit=${selectedUnit}&ids=${ids}&mode=${mode}`
    )
  }

  const isCommonMode = selectedBook === "常用单词"
  const currentUnits = isCommonMode
    ? categories.map((c) => ({ unit: c.key, count: c.count }))
    : books[selectedBook] || []

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center px-4 py-6">
      {/* 标题栏 + 积分 */}
      <header className="w-full max-w-md mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            背单词
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选择课本和单元，开始背诵
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-lg font-bold text-amber-600">{totalPoints}</span>
          <span className="text-xs text-amber-500">积分</span>
        </div>
      </header>

      <div className="w-full max-w-md space-y-4">
        {/* 课本选择 */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <h3 className="font-semibold mb-3">选择课本</h3>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => selectBook("常用单词")}
              className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                selectedBook === "常用单词"
                  ? "border-accent bg-orange-50 text-accent"
                  : "border-border hover:border-accent hover:text-accent"
              }`}
            >
              常用词
            </button>
            {Object.keys(books).map((book) => (
              <button
                key={book}
                onClick={() => selectBook(book)}
                className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                  selectedBook === book
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary hover:text-primary"
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
            <h3 className="font-semibold mb-3">
              {isCommonMode ? "选择词性" : "选择单元"}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {currentUnits.map((u) => (
                <button
                  key={u.unit}
                  onClick={() => selectUnit(u.unit)}
                  className={`h-12 rounded-lg border text-sm font-medium transition-colors ${
                    selectedUnit === u.unit
                      ? isCommonMode
                        ? "border-accent bg-orange-50 text-accent"
                        : "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary hover:text-primary"
                  }`}
                >
                  {isCommonMode
                    ? categories.find((c) => c.key === u.unit)?.name || u.unit
                    : u.unit}
                  <span className="block text-xs text-muted-foreground">
                    {u.count}词
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 模式选择 */}
        {selectedUnit && (
          <div className="p-4 rounded-xl bg-card border border-border">
            <h3 className="font-semibold mb-3">练习模式</h3>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "sort", label: "字母排序" },
                { key: "fill", label: "字母填空" },
                { key: "zh2en", label: "汉语选单词" },
                { key: "en2zh", label: "单词选汉语" },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                    mode === m.key
                      ? isCommonMode
                        ? "border-accent bg-orange-50 text-accent"
                        : "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary hover:text-primary"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 开始背诵按钮 */}
        {selectedUnit && (
          <button
            onClick={startLearning}
            disabled={selectedWordIds.size === 0}
            className={`w-full h-12 rounded-xl text-white text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform ${
              isCommonMode ? "bg-accent" : "bg-primary"
            }`}
          >
            {selectedWordIds.size > 0
              ? `开始背诵（${selectedWordIds.size} 词）`
              : "请先选择单词"}
          </button>
        )}

        {/* 单词列表表格 */}
        {selectedUnit && wordStats.length > 0 && (
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th
                        className="px-3 py-2.5 text-left font-medium cursor-pointer hover:bg-muted select-none"
                        onClick={toggleAll}
                      >
                        <span className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            className="w-4 h-4 accent-primary"
                          />
                          选择
                        </span>
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium">单词</th>
                      <th className="px-3 py-2.5 text-center font-medium">次数</th>
                      <th className="px-3 py-2.5 text-center font-medium">正确率</th>
                      <th className="px-3 py-2.5 text-center font-medium">积分</th>
                      <th className="px-3 py-2.5 text-center font-medium">下次</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wordStats.map((w) => (
                      <tr
                        key={w.id}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedWordIds.has(w.id)}
                            onChange={() => toggleWord(w.id)}
                            className="w-4 h-4 accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <img
                              src={`/images/words/${selectedBook}/${w.id}.png`}
                              alt={w.word}
                              className="w-8 h-8 rounded-lg flex-shrink-0"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement
                                if (!img.src.endsWith(".svg")) {
                                  img.src = `/images/words/${selectedBook}/${w.id}.svg`
                                } else {
                                  img.style.display = "none"
                                }
                              }}
                            />
                            <div>
                              <div className="font-medium text-foreground">
                                {w.word}
                              </div>
                              {w.meaning && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {w.meaning}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {w.totalCount > 0 ? w.totalCount : "-"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {w.totalCount > 0 ? (
                            <span
                              className={
                                w.correctRate >= 80
                                  ? "text-success font-medium"
                                  : w.correctRate >= 50
                                    ? "text-amber-500 font-medium"
                                    : "text-error font-medium"
                              }
                            >
                              {w.correctRate}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {w.points > 0 ? (
                            <span className="text-amber-500 font-medium">
                              {w.points}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {w.nextReviewText || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
