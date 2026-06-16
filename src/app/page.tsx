"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { BookOpen, Brain, RotateCcw, BarChart3 } from "lucide-react"

export default function HomePage() {
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    fetch("/api/words/review-count")
      .then((res) => res.json())
      .then((data) => setReviewCount(data.count || 0))
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-8 sm:py-12">
      {/* Header */}
      <header className="text-center mb-8 sm:mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary">
          🌟 EasyWord
        </h1>
        <p className="mt-2 text-base sm:text-lg text-muted-foreground">
          轻松背单词，快乐学英语
        </p>
      </header>

      {/* Main menu - big friendly cards */}
      <main className="w-full max-w-md grid grid-cols-2 gap-4 sm:gap-6">
        <Link href="/vocabulary" className="group">
          <div className="flex flex-col items-center gap-3 p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm transition-all group-hover:shadow-md group-hover:scale-[1.02] group-active:scale-95">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Brain className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            </div>
            <span className="text-base sm:text-lg font-semibold text-card-foreground">
              背单词
            </span>
          </div>
        </Link>

        <Link href="/reading" className="group">
          <div className="flex flex-col items-center gap-3 p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm transition-all group-hover:shadow-md group-hover:scale-[1.02] group-active:scale-95">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-orange-100 flex items-center justify-center">
              <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-accent" />
            </div>
            <span className="text-base sm:text-lg font-semibold text-card-foreground">
              阅读练习
            </span>
          </div>
        </Link>

        <Link href="/review" className="group">
          <div className="flex flex-col items-center gap-3 p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm transition-all group-hover:shadow-md group-hover:scale-[1.02] group-active:scale-95">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center">
              <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8 text-success" />
            </div>
            <span className="text-base sm:text-lg font-semibold text-card-foreground">
              复习
            </span>
          </div>
        </Link>

        <Link href="/history" className="group">
          <div className="flex flex-col items-center gap-3 p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm transition-all group-hover:shadow-md group-hover:scale-[1.02] group-active:scale-95">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-purple-100 flex items-center justify-center">
              <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 text-purple-500" />
            </div>
            <span className="text-base sm:text-lg font-semibold text-card-foreground">
              我的进度
            </span>
          </div>
        </Link>
      </main>

      {/* Review reminder banner */}
      <div className="w-full max-w-md mt-6 sm:mt-8 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <p className="text-sm text-amber-800 text-center">
          {reviewCount > 0 ? (
            <>
              📖 你有 <span className="font-bold">{reviewCount}</span> 个单词需要复习
            </>
          ) : (
            "🎉 暂时没有需要复习的单词，继续学习吧！"
          )}
        </p>
      </div>
    </div>
  )
}
