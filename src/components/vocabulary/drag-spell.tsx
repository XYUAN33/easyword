"use client"

import { useState, useCallback } from "react"
import { LetterSort } from "./letter-sort"
import { speak } from "@/lib/speech"
import { cn } from "@/lib/utils"

interface DragSpellProps {
  word: string
  meaning?: string
  onComplete: (remembered: boolean) => void
  maxErrors?: number
}

export function DragSpell({ word, meaning, onComplete, maxErrors = 4 }: DragSpellProps) {
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [completed, setCompleted] = useState(false)

  const handleSpellComplete = useCallback(() => {
    setCompleted(true)
    speak(word)
    // 延迟一下让用户看到成功状态
    setTimeout(() => onComplete(true), 1500)
  }, [onComplete, word])

  const handleSpellError = useCallback(() => {
    const newCount = consecutiveErrors + 1
    setConsecutiveErrors(newCount)

    if (newCount >= maxErrors) {
      // 连续错误达到上限，显示正确答案
      setShowAnswer(true)
      setTimeout(() => {
        setShowAnswer(false)
        setConsecutiveErrors(0)
      }, 3000)
    }
  }, [consecutiveErrors, maxErrors])

  const handleGiveUp = useCallback(() => {
    onComplete(false)
  }, [onComplete])

  return (
    <div className="flex flex-col flex-1 px-4">
      {/* 成功状态 */}
      {completed && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-6xl animate-bounce">🎉</div>
          <p className="text-2xl font-bold text-success">拼写正确！</p>
          <p className="text-xl text-foreground">{word}</p>
        </div>
      )}

      {/* 显示正确答案 */}
      {showAnswer && !completed && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-300 text-center">
            <p className="text-sm text-amber-700 mb-2">
              连续 {maxErrors} 次错误，显示正确答案：
            </p>
            <p className="text-3xl font-bold text-foreground">{word}</p>
            {meaning && (
              <p className="text-lg text-amber-700 mt-1">{meaning}</p>
            )}
            <button
              onClick={() => speak(word)}
              className="mt-3 px-4 py-1.5 rounded-lg text-primary hover:bg-primary/10 text-sm"
            >
              🔊 听发音
            </button>
          </div>
          <p className="text-sm text-muted-foreground">3 秒后重新开始...</p>
        </div>
      )}

      {/* 拼写区域 */}
      {!completed && !showAnswer && (
        <>
          <div className="text-center mb-4">
            <p className="text-lg font-semibold text-foreground">{word}</p>
            {meaning && (
              <p className="text-base text-accent font-medium mt-1">{meaning}</p>
            )}
            <button
              onClick={() => speak(word)}
              className="text-sm text-primary hover:underline"
            >
              🔊 再听一次
            </button>
          </div>

          <LetterSort
            word={word}
            onComplete={handleSpellComplete}
            onError={handleSpellError}
            maxErrors={maxErrors}
            consecutiveErrors={consecutiveErrors}
          />

          {/* 错误提示 */}
          {consecutiveErrors > 0 && (
            <p className="text-center text-sm text-error mt-2">
              还可以错 {maxErrors - consecutiveErrors} 次
            </p>
          )}

          {/* 跳过按钮 */}
          <button
            onClick={handleGiveUp}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground text-center"
          >
            记不住，跳过这个词 →
          </button>
        </>
      )}
    </div>
  )
}
