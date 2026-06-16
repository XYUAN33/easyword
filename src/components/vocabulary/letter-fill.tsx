"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle } from "lucide-react"

interface LetterFillProps {
  word: string
  onComplete: (correct: boolean) => void
}

export function LetterFill({ word, onComplete }: LetterFillProps) {
  const lowerWord = word.toLowerCase()
  const letters = lowerWord.split("")

  // 计算隐藏字母数量
  const hiddenCount = useMemo(() => {
    const len = letters.length
    if (len <= 4) return 1
    if (len <= 8) return 2
    return 3
  }, [word])

  // 选择隐藏位置 + 生成干扰字母
  const { hiddenPositions, correctLetters, allLetters } = useMemo(() => {
    // 随机选择隐藏位置
    const indices = Array.from({ length: letters.length }, (_, i) => i)
    const shuffled = [...indices].sort(() => Math.random() - 0.5)
    const hidePos = new Set(shuffled.slice(0, hiddenCount).sort((a, b) => a - b))

    // 正确字母（被隐藏的）
    const correct = hidePos.size > 0 ? Array.from(hidePos).map((i) => letters[i]) : []

    // 生成 2 个干扰字母：从 a-z 中随机选，排除隐藏字母中已有的
    const correctSet = new Set(correct)
    const alphabet = "abcdefghijklmnopqrstuvwxyz"
    const available = alphabet.split("").filter((l) => !correctSet.has(l))
    const distractors: string[] = []
    while (distractors.length < 2) {
      const idx = Math.floor(Math.random() * available.length)
      if (!distractors.includes(available[idx])) {
        distractors.push(available[idx])
      }
    }

    // 合并并打乱所有待选字母
    const all = [...correct, ...distractors].sort(() => Math.random() - 0.5)

    return { hiddenPositions: hidePos, correctLetters: correct, allLetters: all }
  }, [word, hiddenCount])

  const [filled, setFilled] = useState<(string | null)[]>(
    new Array(hiddenCount).fill(null)
  )
  const [availablePool, setAvailablePool] = useState<string[]>([...allLetters])
  const [submitted, setSubmittedInternal] = useState(false)
  const [correct, setCorrect] = useState(false)

  // 点击备选字母 → 填入
  const handleSelectLetter = (letter: string, poolIndex: number) => {
    if (submitted) return
    // 找到第一个空位
    const emptyIndex = filled.findIndex((f) => f === null)
    if (emptyIndex === -1) return

    const newFilled = [...filled]
    newFilled[emptyIndex] = letter
    setFilled(newFilled)

    const newPool = [...availablePool]
    newPool.splice(poolIndex, 1)
    setAvailablePool(newPool)
  }

  // 点击已填字母 → 退回
  const handleRemoveLetter = (fillIndex: number) => {
    if (submitted) return
    const letter = filled[fillIndex]
    if (!letter) return

    const newFilled = [...filled]
    newFilled[fillIndex] = null
    setFilled(newFilled)

    setAvailablePool((prev) => [...prev, letter])
  }

  // 确认
  const handleSubmit = () => {
    if (filled.some((f) => f === null)) return
    const userAnswer = filled.join("")
    const expectedAnswer = Array.from(hiddenPositions)
      .map((i) => letters[i])
      .join("")
    const isCorrect = userAnswer === expectedAnswer
    setCorrect(isCorrect)
    setSubmittedInternal(true)

    setTimeout(() => onComplete(isCorrect), 1200)
  }

  const allFilled = filled.every((f) => f !== null)

  return (
    <div className="flex flex-col items-center gap-6 flex-1 px-4">
      {/* 单词展示（部分隐藏） */}
      <div className="w-full p-6 rounded-2xl bg-card border border-border text-center">
        <p className="text-sm text-muted-foreground mb-3">补充缺失的字母</p>
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {letters.map((letter, i) => {
            const isHidden = hiddenPositions.has(i)
            if (isHidden) {
              // 找到这个隐藏位置在 filled 中的索引
              const hiddenArray = Array.from(hiddenPositions)
              const fillIndex = hiddenArray.indexOf(i)
              const val = filled[fillIndex]

              return (
                <div
                  key={i}
                  className={cn(
                    "w-9 h-11 rounded-lg border-2 border-dashed flex items-center justify-center text-xl font-bold transition-colors",
                    submitted
                      ? correct
                        ? "border-success bg-green-50 text-success"
                        : "border-error bg-red-50 text-error"
                      : val
                        ? "border-primary bg-primary/10 text-primary cursor-pointer"
                        : "border-muted-foreground/30 bg-muted"
                  )}
                  onClick={() => val && handleRemoveLetter(fillIndex)}
                >
                  {val || (submitted ? letters[i] : "_")}
                </div>
              )
            }
            return (
              <div
                key={i}
                className="w-9 h-11 rounded-lg border border-border bg-card flex items-center justify-center text-xl font-bold text-foreground"
              >
                {letter}
              </div>
            )
          })}
        </div>
      </div>

      {/* 备选字母 */}
      {!submitted && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {availablePool.map((letter, i) => (
            <button
              key={`${letter}-${i}`}
              onClick={() => handleSelectLetter(letter, i)}
              className="w-10 h-12 rounded-xl bg-card border-2 border-border flex items-center justify-center text-xl font-bold hover:border-primary hover:shadow-md active:scale-95 transition-all"
            >
              {letter}
            </button>
          ))}
        </div>
      )}

      {/* 结果提示 */}
      {submitted && (
        <div className="text-center">
          {correct ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
              <p className="text-success font-bold text-lg">拼写正确！</p>
            </>
          ) : (
            <>
              <XCircle className="w-10 h-10 text-error mx-auto mb-2" />
              <p className="text-error font-bold text-lg">
                正确答案：{word}
              </p>
            </>
          )}
        </div>
      )}

      {/* 确认按钮 */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!allFilled}
          className="w-full h-12 rounded-xl bg-primary text-white text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
        >
          {allFilled ? "确认" : `请补充 ${filled.filter((f) => f === null).length} 个字母`}
        </button>
      )}
    </div>
  )
}
