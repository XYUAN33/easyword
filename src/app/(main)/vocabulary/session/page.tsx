"use client"

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { speak, spellWord, preloadLetters } from "@/lib/speech"
import { LetterSort } from "@/components/vocabulary/letter-sort"
import { LetterFill } from "@/components/vocabulary/letter-fill"
import { WordChoice } from "@/components/vocabulary/word-choice"
import { Volume2, SkipForward, Loader2 } from "lucide-react"

interface Word {
  id: number
  word: string
  meaning: string
  phonetic: string | null
  audioUrl?: string | null
  phrases: { text: string; audioUrl?: string }[]
  sentences: { text: string; audioUrl?: string; source?: string }[]
  progress: unknown
}

type Step = "listen" | "spell" | "sort" | "fill" | "choice" | "done"

export default function VocabularySessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <SessionContent />
    </Suspense>
  )
}

function SessionContent() {
  const searchParams = useSearchParams()
  const book = searchParams.get("book") || "4B"
  const unit = searchParams.get("unit") || "Unit1"
  const idsParam = searchParams.get("ids")
  const mode = (searchParams.get("mode") || "sort") as "sort" | "fill" | "zh2en" | "en2zh"

  const [words, setWords] = useState<Word[]>([])
  const [distractorPool, setDistractorPool] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [step, setStep] = useState<Step>(
    mode === "sort" ? "listen" : mode === "fill" ? "fill" : "choice"
  )
  const [loading, setLoading] = useState(true)
  const [completedCount, setCompletedCount] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  const [showCongrats, setShowCongrats] = useState(false)
  const [translateHint, setTranslateHint] = useState(false)
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentWord = words[currentIndex]
  const MAX_ERRORS = 4

  // 选择题模式：预生成选项（useMemo 锁定，只在单词切换时重新生成）
  const choiceData = useMemo(() => {
    if (!currentWord || mode === "sort") return null
    const pool = distractorPool.length > 0 ? distractorPool : words
    const otherWords = pool
      .filter((w) => w.id !== currentWord.id && w.word !== currentWord.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)

    const options =
      mode === "zh2en"
        ? [
            ...otherWords.map((w) => ({ label: w.word, isCorrect: false as const })),
            { label: currentWord.word, isCorrect: true as const },
          ].sort(() => Math.random() - 0.5)
        : [
            ...otherWords.map((w) => ({ label: w.meaning || w.word, isCorrect: false as const })),
            { label: currentWord.meaning || currentWord.word, isCorrect: true as const },
          ].sort(() => Math.random() - 0.5)

    const question =
      mode === "zh2en" ? currentWord.meaning || currentWord.word : currentWord.word

    return { question, options }
  }, [currentWord?.id, distractorPool.length, mode, words.length])

  // 预加载字母音频
  useEffect(() => { preloadLetters() }, [])

  // 加载单词（支持按 ID 过滤，常用词也走 stats API 获取真实 ID）
  useEffect(() => {
    async function loadWords() {
      try {
        const isCommon = book === "常用单词"
        setTranslateHint(isCommon)

        let apiUrl: string
        if (isCommon) {
          // 常用词：先同步到数据库，再用 stats API
          await fetch("/api/words/sync-common", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: unit }),
          })
          apiUrl = `/api/words/stats?book=${encodeURIComponent(book)}&unit=${encodeURIComponent(unit)}`
        } else {
          apiUrl = `/api/words/list?book=${encodeURIComponent(book)}&unit=${encodeURIComponent(unit)}`
        }

        const res = await fetch(apiUrl)
        const data = await res.json()
        if (data.words) {
          let filtered = data.words
          // 如果指定了 ID 列表，只保留选中的单词
          if (idsParam) {
            const selectedIds = new Set(idsParam.split(",").map(Number))
            filtered = data.words.filter((w: any) => selectedIds.has(w.id))
          }
          // 统一字段名（stats API 返回的字段名可能不同）
          const normalized = filtered.map((w: any) => ({
            id: w.id,
            word: w.word,
            meaning: w.meaning || "",
            phonetic: w.phonetic || null,
            audioUrl: w.audioUrl || null,
            phrases: w.phrases || [],
            sentences: w.sentences || [],
            progress: w.progress || null,
          }))
          setWords(normalized)
        }
      } catch (e) {
        console.error("加载单词失败:", e)
      } finally {
        setLoading(false)
      }
    }
    loadWords()
  }, [book, unit, idsParam])

  // 选择题模式：加载整本书的单词作为干扰项池
  useEffect(() => {
    if (mode === "sort" || mode === "fill" || book === "常用单词") return
    async function loadDistractors() {
      try {
        const res = await fetch(`/api/words/list?book=${encodeURIComponent(book)}&unit=`)
        const data = await res.json()
        if (data.words) {
          setDistractorPool(data.words)
        }
      } catch {}
    }
    loadDistractors()
  }, [book, mode])

  // 步骤A：跟读（优先使用预生成音频）
  const handleListen = useCallback(async () => {
    if (!currentWord) return
    await speak(currentWord.word, 0.8, currentWord.audioUrl)
    for (const phrase of currentWord.phrases) {
      await speak(phrase.text, 0.8, phrase.audioUrl)
    }
  }, [currentWord])

  // 步骤B：拼读
  const handleSpell = useCallback(async () => {
    if (!currentWord) return
    await spellWord(currentWord.word)
  }, [currentWord])

  // 记录学习进度
  const recordProgress = useCallback(
    async (action: "correct" | "error") => {
      if (!currentWord) return
      try {
        await fetch("/api/words/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wordId: currentWord.id, action }),
        })
      } catch (e) {
        console.error("记录进度失败:", e)
      }
    },
    [currentWord]
  )

  // 步骤C排序完成回调
  const handleSortComplete = useCallback(() => {
    setConsecutiveErrors(0)
    setShowCongrats(true)
    recordProgress("correct")
    setCompletedCount((c) => c + 1)

    setTimeout(() => {
      setShowCongrats(false)
      if (currentIndex < words.length - 1) {
        setCurrentIndex((i) => i + 1)
        setStep("listen")
      } else {
        setStep("done")
      }
    }, 1500)
  }, [currentIndex, words.length, recordProgress])

  // 步骤C排序错误回调
  const handleSortError = useCallback(() => {
    const newErrors = consecutiveErrors + 1
    setConsecutiveErrors(newErrors)
    recordProgress("error")

    if (newErrors >= MAX_ERRORS) {
      setShowAnswer(true)
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current)
      answerTimerRef.current = setTimeout(() => {
        setShowAnswer(false)
        setConsecutiveErrors(0)
      }, 3000)
    }
  }, [consecutiveErrors, recordProgress])

  // 跳过当前词
  const handleSkip = useCallback(() => {
    setConsecutiveErrors(0)
    setShowAnswer(false)
    if (currentIndex < words.length - 1) {
      setCurrentIndex((i) => i + 1)
      setStep("listen")
    } else {
      setStep("done")
    }
  }, [currentIndex, words.length])

  // 清理 timer
  useEffect(() => {
    return () => {
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {translateHint ? "正在翻译常用词，请稍候..." : "加载中..."}
        </p>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4">
        <p className="text-lg text-muted-foreground">没有找到单词</p>
        <a href="/vocabulary" className="text-primary font-medium">
          返回选择
        </a>
      </div>
    )
  }

  // 完成所有单词
  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 px-4">
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold text-foreground">太棒了！</h1>
        <p className="text-lg text-muted-foreground">
          你完成了 <span className="text-primary font-bold">{words.length}</span> 个单词的学习！
        </p>
        <a
          href="/vocabulary"
          className="h-12 px-8 rounded-xl bg-primary text-white text-lg font-semibold flex items-center"
        >
          继续学习
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 px-4 py-6 max-w-md mx-auto w-full">
      {/* 进度条 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {book} {unit}
          </span>
          <span className="text-sm font-medium text-primary">
            {completedCount}/{words.length}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${(completedCount / words.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 步骤A：跟读 */}
      {step === "listen" && (
        <div className="flex flex-col items-center gap-6 flex-1">
          <div className="text-center">
            {/* 单词配图 */}
            <img
              src={`/images/words/${book}/${currentWord.id}.png`}
              alt={currentWord.word}
              className="w-32 h-32 mx-auto mb-4 rounded-2xl"
              onError={(e) => {
                const img = e.target as HTMLImageElement
                if (!img.src.endsWith(".svg")) {
                  img.src = `/images/words/${book}/${currentWord.id}.svg`
                } else {
                  img.style.display = "none"
                }
              }}
            />
            <h2 className="text-3xl font-bold text-foreground mb-2">
              {currentWord.word}
            </h2>
            {currentWord.phonetic && (
              <p className="text-lg text-muted-foreground">
                {currentWord.phonetic}
              </p>
            )}
            {currentWord.meaning && (
              <p className="text-xl text-accent font-medium mt-1">
                {currentWord.meaning}
              </p>
            )}
          </div>

          {/* 短语 */}
          {currentWord.phrases.length > 0 && (
            <div className="w-full p-4 rounded-xl bg-card border border-border">
              <p className="text-sm text-muted-foreground mb-2">常用短语：</p>
              {currentWord.phrases.map((p, i) => (
                <p key={i} className="text-lg text-foreground">
                  {p.text}
                </p>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleListen}
              className="w-full h-12 rounded-xl bg-primary text-white text-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Volume2 className="w-5 h-5" />
              朗读
            </button>
            <button
              onClick={() => setStep("spell")}
              className="w-full h-12 rounded-xl bg-accent text-white text-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <SkipForward className="w-5 h-5" />
              下一步
            </button>
          </div>
        </div>
      )}

      {/* 步骤B：拼读 */}
      {step === "spell" && (
        <div className="flex flex-col items-center gap-6 flex-1">
          <div className="text-center">
            {/* 单词配图 */}
            <img
              src={`/images/words/${book}/${currentWord.id}.png`}
              alt={currentWord.word}
              className="w-32 h-32 mx-auto mb-4 rounded-2xl"
              onError={(e) => {
                const img = e.target as HTMLImageElement
                if (!img.src.endsWith(".svg")) {
                  img.src = `/images/words/${book}/${currentWord.id}.svg`
                } else {
                  img.style.display = "none"
                }
              }}
            />
            <h2 className="text-3xl font-bold text-foreground mb-2">
              {currentWord.word}
            </h2>
            {currentWord.meaning && (
              <p className="text-xl text-accent font-medium">
                {currentWord.meaning}
              </p>
            )}
          </div>

          <button
            onClick={handleSpell}
            className="w-full h-12 rounded-xl bg-primary text-white text-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Volume2 className="w-5 h-5" />
            听拼读
          </button>

          <button
            onClick={() => setStep("sort")}
            className="w-full h-12 rounded-xl bg-accent text-white text-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <SkipForward className="w-5 h-5" />
            开始排序
          </button>
        </div>
      )}

      {/* 步骤C：拖拽排序 */}
      {step === "sort" && (
        <div className="flex flex-col items-center gap-6 flex-1">
          {/* 单词配图 */}
          <img
            src={`/images/words/${book}/${currentWord.id}.png`}
            alt={currentWord.word}
            className="w-28 h-28 mx-auto rounded-2xl"
            onError={(e) => {
              const img = e.target as HTMLImageElement
              if (!img.src.endsWith(".svg")) {
                img.src = `/images/words/${book}/${currentWord.id}.svg`
              } else {
                img.style.display = "none"
              }
            }}
          />

          {/* 显示正确答案（容错提示） */}
          {showAnswer && (
            <div className="w-full p-4 rounded-xl bg-amber-50 border border-amber-200 text-center animate-pulse">
              <p className="text-amber-800 text-lg">
                正确答案：<span className="font-bold">{currentWord.word}</span>
              </p>
              {currentWord.meaning && (
                <p className="text-amber-700 mt-1">{currentWord.meaning}</p>
              )}
            </div>
          )}

          {/* 中文释义提示 */}
          {currentWord.meaning && !showAnswer && (
            <p className="text-xl text-accent font-medium text-center">
              {currentWord.meaning}
            </p>
          )}

          <LetterSort
            word={currentWord.word}
            onComplete={handleSortComplete}
            onError={handleSortError}
            maxErrors={MAX_ERRORS}
            consecutiveErrors={consecutiveErrors}
          />

          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground underline"
          >
            跳过这个词
          </button>
        </div>
      )}

      {/* 步骤C-1：字母填空模式 */}
      {step === "fill" && currentWord && (
        <div className="flex flex-col items-center gap-6 flex-1">
          {/* 单词配图 */}
          <img
            src={`/images/words/${book}/${currentWord.id}.png`}
            alt={currentWord.word}
            className="w-28 h-28 mx-auto rounded-2xl"
            onError={(e) => {
              const img = e.target as HTMLImageElement
              if (!img.src.endsWith(".svg")) {
                img.src = `/images/words/${book}/${currentWord.id}.svg`
              } else {
                img.style.display = "none"
              }
            }}
          />
          <LetterFill
            key={currentWord.id}
            word={currentWord.word}
          onComplete={(correct) => {
            if (correct) {
              setConsecutiveErrors(0)
              setShowCongrats(true)
              recordProgress("correct")
              setCompletedCount((c) => c + 1)
            } else {
              recordProgress("error")
            }
            setTimeout(() => {
              setShowCongrats(false)
              if (currentIndex < words.length - 1) {
                setCurrentIndex((i) => i + 1)
              } else {
                setStep("done")
              }
            }, 1200)
          }}
        />
        </div>
      )}

      {/* 步骤C-2：选择题模式（汉语选单词 / 单词选汉语） */}
      {step === "choice" && currentWord && choiceData && (
        <WordChoice
          key={currentWord.id}
          question={choiceData.question}
          options={choiceData.options}
          onComplete={(correct) => {
            if (correct) {
              setConsecutiveErrors(0)
              setShowCongrats(true)
              recordProgress("correct")
              setCompletedCount((c) => c + 1)
            } else {
              recordProgress("error")
            }
            setTimeout(() => {
              setShowCongrats(false)
              if (currentIndex < words.length - 1) {
                setCurrentIndex((i) => i + 1)
              } else {
                setStep("done")
              }
            }, 1200)
          }}
        />
      )}

      {/* 大赞动画 */}
      {showCongrats && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center animate-bounce">
            <div className="text-8xl">👍</div>
            <p className="text-2xl font-bold text-success mt-2">太棒了！</p>
          </div>
        </div>
      )}
    </div>
  )
}
