"use client"

import { useState, useEffect } from "react"
import { BarChart3, Loader2, BookOpen, Brain, Flame } from "lucide-react"

interface Stats {
  totalWords: number
  masteredWords: number
  reviewingWords: number
  learningWords: number
  readingCount: number
  streak: number
  dailyCounts: Record<string, number>
  recentReadings: {
    book: string
    unit: string
    score: number | null
    createdAt: string
  }[]
}

export default function HistoryPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setStats(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center px-4 py-6">
        <p className="text-muted-foreground">加载失败</p>
      </div>
    )
  }

  // 构建最近 7 天的日期标签
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 6 + i)
    return d.toISOString().split("T")[0]
  })

  const maxDaily = Math.max(...last7Days.map((d) => stats.dailyCounts[d] || 0), 1)

  return (
    <div className="flex flex-col items-center px-4 py-6">
      <header className="w-full max-w-md mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-purple-500" />
          我的进度
        </h1>
      </header>

      <div className="w-full max-w-md space-y-4">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <Brain className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-primary">{stats.totalWords}</p>
            <p className="text-xs text-muted-foreground mt-1">已学单词</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <p className="text-2xl font-bold text-success">{stats.masteredWords}</p>
            <p className="text-xs text-muted-foreground mt-1">已掌握</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <BookOpen className="w-5 h-5 text-accent mx-auto mb-1" />
            <p className="text-2xl font-bold text-accent">{stats.readingCount}</p>
            <p className="text-xs text-muted-foreground mt-1">阅读练习</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-500">{stats.streak}</p>
            <p className="text-xs text-muted-foreground mt-1">连续天数</p>
          </div>
        </div>

        {/* 学习进度条 */}
        {stats.totalWords > 0 && (
          <div className="p-4 rounded-xl bg-card border border-border">
            <h3 className="font-semibold mb-3">学习进度</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-success">已掌握</span>
                <span>{stats.masteredWords} 词</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-success h-2.5 rounded-full"
                  style={{
                    width: `${(stats.masteredWords / stats.totalWords) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary">复习中</span>
                <span>{stats.reviewingWords} 词</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full"
                  style={{
                    width: `${(stats.reviewingWords / stats.totalWords) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-500">学习中</span>
                <span>{stats.learningWords} 词</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-amber-500 h-2.5 rounded-full"
                  style={{
                    width: `${(stats.learningWords / stats.totalWords) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 最近 7 天学习量 */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <h3 className="font-semibold mb-3">最近 7 天</h3>
          <div className="flex items-end justify-between gap-1 h-24">
            {last7Days.map((day) => {
              const count = stats.dailyCounts[day] || 0
              const height = count > 0 ? (count / maxDaily) * 100 : 4
              const date = new Date(day)
              const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()]
              return (
                <div key={day} className="flex flex-col items-center flex-1 gap-1">
                  <span className="text-xs text-muted-foreground">
                    {count > 0 ? count : ""}
                  </span>
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all"
                    style={{ height: `${height}%`, minHeight: 4 }}
                  />
                  <span className="text-xs text-muted-foreground">{weekday}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 最近阅读记录 */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <h3 className="font-semibold mb-3">最近阅读</h3>
          {stats.recentReadings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              还没有阅读记录，快去练习吧！
            </p>
          ) : (
            <div className="space-y-2">
              {stats.recentReadings.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                >
                  <div>
                    <span className="font-medium">
                      {r.book} {r.unit}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  {r.score !== null && (
                    <span
                      className={`font-bold ${
                        r.score >= 3 ? "text-success" : "text-amber-500"
                      }`}
                    >
                      {r.score}分
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 空状态引导 */}
        {stats.totalWords === 0 && stats.readingCount === 0 && (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              还没有学习记录，快去背单词吧！
            </p>
            <a
              href="/vocabulary"
              className="inline-block px-6 py-3 rounded-xl bg-primary text-white font-semibold active:scale-95 transition-transform"
            >
              开始学习
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
