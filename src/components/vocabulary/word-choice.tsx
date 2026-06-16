"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle } from "lucide-react"

interface ChoiceOption {
  label: string
  isCorrect: boolean
}

interface WordChoiceProps {
  question: string
  options: ChoiceOption[]
  onComplete: (correct: boolean) => void
}

export function WordChoice({ question, options, onComplete }: WordChoiceProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)

  const handleSelect = (index: number) => {
    if (revealed) return
    setSelectedIndex(index)
    setRevealed(true)

    const correct = options[index].isCorrect
    setTimeout(() => onComplete(correct), 1200)
  }

  return (
    <div className="flex flex-col items-center gap-6 flex-1 px-4">
      {/* 题目 */}
      <div className="w-full p-6 rounded-2xl bg-card border border-border text-center">
        <p className="text-sm text-muted-foreground mb-2">
          {options[0]?.label.length > 10 ? "选择对应的英文单词" : "选择对应的中文释义"}
        </p>
        <p className="text-2xl font-bold text-foreground">{question}</p>
      </div>

      {/* 选项 */}
      <div className="w-full space-y-3">
        {options.map((opt, i) => {
          const isSelected = selectedIndex === i
          const isCorrect = opt.isCorrect

          let borderColor = "border-border"
          let bgColor = "bg-card"
          if (revealed) {
            if (isCorrect) {
              borderColor = "border-success"
              bgColor = "bg-green-50"
            } else if (isSelected && !isCorrect) {
              borderColor = "border-error"
              bgColor = "bg-red-50"
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={revealed}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-lg font-medium transition-colors flex items-center justify-between",
                borderColor,
                bgColor,
                !revealed && "hover:border-primary hover:bg-primary/5 cursor-pointer"
              )}
            >
              <span>
                {String.fromCharCode(65 + i)}. {opt.label}
              </span>
              {revealed && isCorrect && (
                <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
              )}
              {revealed && isSelected && !isCorrect && (
                <XCircle className="w-6 h-6 text-error flex-shrink-0" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
