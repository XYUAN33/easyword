"use client"

import { useState, useEffect, useCallback } from "react"
import { RotateCcw, Loader2, CheckCircle, XCircle, ArrowRight } from "lucide-react"
import { speak } from "@/lib/speech"
import { DragSpell } from "@/components/vocabulary/drag-spell"

interface ReviewWord {
  progressId: number
  wordId: number
  word: string
  meaning: string
  phonetic: string
  book: string
  unit: string
  phrases: { text: string; audioUrl?: string }[]
  sentences: { text: string; audioUrl?: string }[]
  reviewCount: number
  status: string
}

type Phase = "loading" | "empty" | "preview" | "spell" | "result"

export default function ReviewPage() {
  const [words, setWords] = useState<ReviewWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>("loading")
  const [completedCount, setCompletedCount] = useState(0)
  const [results, setResults] = useState<
    { word: string; remembered: boolean }[]
  >([])

  // 加载待复习单词
  useEffect(() => {
    fetch("/api/words/review?limit=20")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setPhase("empty")
        } else if (data.words.length === 0) {
          setPhase("empty")
        } else {
          setWords(data.words)
          setPhase("preview")
        }
      })
      .catch(() => setPhase("empty"))
  }, [])

  const currentWord = words[currentIndex]

  // 开始拼写
  const startSpell = useCallback(() => {
    if (currentWord) {
      speak(currentWord.word)
    }
    setPhase("spell")
  }, [currentWord])

  // 拼写完成
  const handleSpellComplete = useCallback(async (remembered: boolean) => {
    const word = words[currentIndex]

    // 上报复习结果
    fetch("/api/words/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: word.wordId, remembered }),
    })

    setResults((prev) => [...prev, { word: word.word, remembered }])
    setCompletedCount((c) => c + 1)

    // 下一个单词或结束
    if (currentIndex < words.length - 1) {
      setCurrentIndex((i) => i + 1)
      setPhase("preview")
    } else {
      setPhase("result")
    }
  }, [currentIndex, words])

  // 加载中
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">检查待复习单词...</p>
      </div>
    )
  }

  // 没有待复习的词
  if (phase === "empty") {
    return (
      <div className="flex flex-col items-center px-4 py-6">
        <header className="w-full max-w-md mb-8">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-success" />
            复习
          </h1>
        </header>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-5xl">🎉</span>
          </div>
          <h2 className="text-xl font-semibold">全部复习完毕！</h2>
          <p className="text-muted-foreground max-w-xs">
            目前没有需要复习的单词。继续学习新单词，系统会在合适的时间提醒你复习。
          </p>
          <a
            href="/vocabulary"
            className="mt-4 px-6 py-3 rounded-xl bg-primary text-white font-semibold active:scale-95 transition-transform"
          >
            去背新单词
          </a>
        </div>
      </div>
    )
  }

  // 结果页
  if (phase === "result") {
    const remembered = results.filter((r) => r.remembered).length
    const forgot = results.length - remembered

    return (
      <div className="flex flex-col items-center px-4 py-6">
        <header className="w-full max-w-md mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-success" />
            复习完成
          </h1>
        </header>

        <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border text-center mb-6">
          <div className="text-5xl mb-4">
            {forgot === 0 ? "🎉" : remembered > forgot ? "👍" : "💪"}
          </div>
          <p className="text-2xl font-bold mb-2">
            复习了 {results.length} 个单词
          </p>
          <div className="flex justify-center gap-6 mt-4 mb-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-success">{remembered}</p>
              <p className="text-sm text-muted-foreground">记住了</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-error">{forgot}</p>
              <p className="text-sm text-muted-foreground">忘了</p>
            </div>
          </div>

          {forgot > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                忘记的单词会在 <span className="font-bold">1 天后</span>再次提醒你复习
              </p>
            </div>
          )}

          {/* 复习详情 */}
          <div className="space-y-2 text-left mb-6">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {r.remembered ? (
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-error flex-shrink-0" />
                )}
                <span className="font-medium">{r.word}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 w-full max-w-md">
          <a
            href="/review"
            className="flex-1 h-12 rounded-xl border border-border text-sm font-medium flex items-center justify-center hover:bg-muted transition-colors"
          >
            继续复习
          </a>
          <a
            href="/"
            className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-medium flex items-center justify-center"
          >
            返回首页
          </a>
        </div>
      </div>
    )
  }

  // 预览阶段（展示单词信息）
  if (phase === "preview" && currentWord) {
    return (
      <div className="flex flex-col items-center px-4 py-6">
        <header className="w-full max-w-md mb-2">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-success" />
            复习
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentIndex + 1} / {words.length}
          </p>
        </header>

        {/* 进度条 */}
        <div className="w-full max-w-md mb-6 bg-muted rounded-full h-2">
          <div
            className="bg-success h-2 rounded-full transition-all"
            style={{
              width: `${((currentIndex) / words.length) * 100}%`,
            }}
          />
        </div>

        {/* 单词卡片 */}
        <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border text-center mb-6">
          <p className="text-sm text-muted-foreground mb-2">
            {currentWord.book} {currentWord.unit}
          </p>
          <p className="text-3xl font-bold text-foreground mb-2">
            {currentWord.word}
          </p>
          {currentWord.phonetic && (
            <p className="text-lg text-muted-foreground mb-4">
              {currentWord.phonetic}
            </p>
          )}

          <button
            onClick={() => speak(currentWord.word)}
            className="px-4 py-2 rounded-lg text-primary hover:bg-primary/10 transition-colors text-sm"
          >
            🔊 听发音
          </button>

          {/* 提示复习次数 */}
          {currentWord.reviewCount > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              已复习 {currentWord.reviewCount} 次
            </p>
          )}
        </div>

        <button
          onClick={startSpell}
          className="w-full max-w-md h-12 rounded-xl bg-success text-white text-lg font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          开始拼写
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    )
  }

  // 拼写阶段
  if (phase === "spell" && currentWord) {
    return (
      <div className="flex flex-col flex-1">
        <header className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-success" />
            复习
          </h1>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {words.length}
          </span>
        </header>

        <div className="flex-1 flex flex-col">
          <DragSpell
            word={currentWord.word}
            meaning={currentWord.meaning}
            onComplete={(success) => handleSpellComplete(success)}
          />
        </div>
      </div>
    )
  }

  return null
}
