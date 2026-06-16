"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Volume2, CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react"
import { speak } from "@/lib/speech"

interface Question {
  question: string
  options: string[]
  correct: number
  explanation: string
}

interface ReadingData {
  book: string
  unit: string
  passage: string
  questions: Question[]
}

export default function ReadingSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReadingContent />
    </Suspense>
  )
}

function ReadingContent() {
  const searchParams = useSearchParams()
  const book = searchParams.get("book") || ""
  const unit = searchParams.get("unit") || ""

  const [data, setData] = useState<ReadingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // 作答状态
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  // 加载阅读材料
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/reading/generate?book=${encodeURIComponent(book)}&unit=${encodeURIComponent(unit)}`
        )
        const result = await res.json()
        if (result.error) {
          setError(result.error)
        } else {
          setData(result)
          setAnswers(new Array(result.questions.length).fill(null))
        }
      } catch {
        setError("加载失败，请重试")
      } finally {
        setLoading(false)
      }
    }
    if (book && unit) load()
  }, [book, unit])

  // 选择答案
  const selectAnswer = useCallback(
    (questionIndex: number, optionIndex: number) => {
      if (submitted) return
      setAnswers((prev) => {
        const next = [...prev]
        next[questionIndex] = optionIndex
        return next
      })
    },
    [submitted]
  )

  // 提交批改
  const handleSubmit = useCallback(() => {
    if (!data) return
    if (answers.some((a) => a === null)) return

    let correct = 0
    data.questions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++
    })
    setScore(correct)
    setSubmitted(true)
  }, [data, answers])

  // 朗读短文
  const readPassage = useCallback(() => {
    if (data) speak(data.passage, 0.7)
  }, [data])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">正在生成阅读材料...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4">
        <p className="text-lg text-error">{error}</p>
        <a href="/reading" className="text-primary font-medium">
          返回选择
        </a>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="flex flex-col flex-1 px-4 py-6 max-w-md mx-auto w-full">
      {/* 顶部信息 */}
      <div className="mb-4 flex items-center justify-between">
        <a href="/reading" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
          返回
        </a>
        <span className="text-sm text-muted-foreground">
          {data.book} {data.unit}
        </span>
      </div>

      {/* 短文区域 */}
      <div className="mb-6 p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">阅读短文</h2>
          <button
            onClick={readPassage}
            className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
            title="朗读短文"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
        <div className="text-base leading-relaxed text-foreground whitespace-pre-line">
          {data.passage}
        </div>
      </div>

      {/* 题目区域 */}
      <div className="space-y-4 mb-6">
        <h2 className="font-semibold">练习题</h2>
        {data.questions.map((q, qi) => (
          <div
            key={qi}
            className="p-4 rounded-xl bg-card border border-border"
          >
            <p className="font-medium mb-3">
              {qi + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isSelected = answers[qi] === oi
                const isCorrect = q.correct === oi
                const isWrong = submitted && isSelected && !isCorrect

                let borderColor = "border-border"
                let bgColor = "bg-card"
                if (isSelected && !submitted) {
                  borderColor = "border-primary"
                  bgColor = "bg-primary/5"
                }
                if (submitted && isCorrect) {
                  borderColor = "border-success"
                  bgColor = "bg-green-50"
                }
                if (isWrong) {
                  borderColor = "border-error"
                  bgColor = "bg-red-50"
                }

                return (
                  <button
                    key={oi}
                    onClick={() => selectAnswer(qi, oi)}
                    disabled={submitted}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${borderColor} ${bgColor} ${
                      submitted ? "cursor-default" : "cursor-pointer hover:border-primary"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-xs font-medium flex-shrink-0">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="text-sm">{opt}</span>
                      {submitted && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-success ml-auto flex-shrink-0" />
                      )}
                      {isWrong && (
                        <XCircle className="w-5 h-5 text-error ml-auto flex-shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 解析 */}
            {submitted && (
              <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-800">
                  💡 {q.explanation}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 提交按钮 / 成绩 */}
      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={answers.some((a) => a === null)}
          className="w-full h-12 rounded-xl bg-accent text-white text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
        >
          {answers.some((a) => a === null)
            ? `还有 ${answers.filter((a) => a === null).length} 题未作答`
            : "提交答案"}
        </button>
      ) : (
        <div className="p-6 rounded-xl bg-card border border-border text-center">
          <div className="text-5xl mb-3">
            {score === data.questions.length
              ? "🎉"
              : score >= data.questions.length * 0.75
                ? "👍"
                : "💪"}
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">
            {score}/{data.questions.length}
          </p>
          <p className="text-muted-foreground mb-4">
            {score === data.questions.length
              ? "全部正确，太棒了！"
              : score >= data.questions.length * 0.75
                ? "做得很好，继续加油！"
                : "再试一次，你会更好的！"}
          </p>
          <div className="flex gap-3">
            <a
              href={`/reading/session?book=${book}&unit=${unit}`}
              className="flex-1 h-10 rounded-lg border border-border text-sm font-medium flex items-center justify-center hover:bg-muted transition-colors"
            >
              再做一篇
            </a>
            <a
              href="/reading"
              className="flex-1 h-10 rounded-lg bg-accent text-white text-sm font-medium flex items-center justify-center"
            >
              换个单元
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
