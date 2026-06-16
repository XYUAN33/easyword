"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { speak } from "@/lib/speech"
import { cn } from "@/lib/utils"

interface LetterSortProps {
  word: string
  onComplete: () => void
  onError: () => void
  maxErrors: number
  consecutiveErrors: number
}

interface LetterCard {
  id: string
  letter: string
  originalIndex: number
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function LetterSort({
  word,
  onComplete,
  onError,
  maxErrors,
  consecutiveErrors,
}: LetterSortProps) {
  const [letters, setLetters] = useState<LetterCard[]>([])
  const [slots, setSlots] = useState<(LetterCard | null)[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 初始化：打乱字母
  useEffect(() => {
    const cards: LetterCard[] = word.split("").map((letter, i) => ({
      id: `letter-${i}`,
      letter: letter.toLowerCase(),
      originalIndex: i,
    }))
    // 确保打乱后的顺序和原词不同
    let shuffled = shuffleArray(cards)
    let attempts = 0
    while (
      shuffled.map((c) => c.letter).join("") === word.toLowerCase() &&
      attempts < 20
    ) {
      shuffled = shuffleArray(cards)
      attempts++
    }
    setLetters(shuffled)
    setSlots(new Array(word.length).fill(null))
  }, [word])

  // 检查是否排完
  const checkComplete = useCallback(
    (newSlots: (LetterCard | null)[]) => {
      if (newSlots.every((s) => s !== null)) {
        const result = newSlots.map((s) => s!.letter).join("")
        if (result === word.toLowerCase()) {
          // 正确！
          setTimeout(() => speak(word), 300)
          setTimeout(onComplete, 500)
        } else {
          // 错误
          speak("try again")
          onError()
          // 清空重新来
          setTimeout(() => {
            const cards: LetterCard[] = word.split("").map((letter, i) => ({
              id: `letter-${i}`,
              letter: letter.toLowerCase(),
              originalIndex: i,
            }))
            let shuffled = shuffleArray(cards)
            let attempts = 0
            while (
              shuffled.map((c) => c.letter).join("") === word.toLowerCase() &&
              attempts < 20
            ) {
              shuffled = shuffleArray(cards)
              attempts++
            }
            setLetters(shuffled)
            setSlots(new Array(word.length).fill(null))
          }, 1000)
        }
      }
    },
    [word, onComplete, onError]
  )

  // 放字母到槽位
  const placeLetter = useCallback(
    (letterId: string, slotIndex: number) => {
      const card = letters.find((l) => l.id === letterId)
      if (!card) return
      if (slots[slotIndex] !== null) return // 槽位已有字母

      // 从待选区移除
      setLetters((prev) => prev.filter((l) => l.id !== letterId))
      // 放入槽位
      const newSlots = [...slots]
      newSlots[slotIndex] = card
      setSlots(newSlots)

      checkComplete(newSlots)
    },
    [letters, slots, checkComplete]
  )

  // 从槽位取回字母
  const removeFromSlot = useCallback(
    (slotIndex: number) => {
      const card = slots[slotIndex]
      if (!card) return
      const newSlots = [...slots]
      newSlots[slotIndex] = null
      setSlots(newSlots)
      setLetters((prev) => [...prev, card])
    },
    [slots]
  )

  // Touch / Pointer drag handlers
  const dragDataRef = useRef<{ letterId: string; startX: number; startY: number } | null>(null)

  const handlePointerDown = (letterId: string, e: React.PointerEvent) => {
    dragDataRef.current = { letterId, startX: e.clientX, startY: e.clientY }
    setDragging(letterId)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    // 检测手指/鼠标下方的槽位
    const elements = document.elementsFromPoint(e.clientX, e.clientY)
    const slotEl = elements.find((el) => el.getAttribute("data-slot-index"))
    if (slotEl) {
      const idx = parseInt(slotEl.getAttribute("data-slot-index") || "-1")
      setDragOverSlot(idx >= 0 ? idx : null)
    } else {
      setDragOverSlot(null)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging) return
    const elements = document.elementsFromPoint(e.clientX, e.clientY)
    const slotEl = elements.find((el) => el.getAttribute("data-slot-index"))
    if (slotEl) {
      const idx = parseInt(slotEl.getAttribute("data-slot-index") || "-1")
      if (idx >= 0 && slots[idx] === null) {
        placeLetter(dragging, idx)
      }
    }
    setDragging(null)
    setDragOverSlot(null)
    dragDataRef.current = null
  }

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-8">
      {/* 槽位区域 */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {slots.map((card, i) => (
          <div
            key={`slot-${i}`}
            data-slot-index={i}
            onPointerUp={(e) => {
              // 点击已有字母则取回
              if (card) {
                e.preventDefault()
                removeFromSlot(i)
              }
            }}
            className={cn(
              "w-12 h-14 sm:w-14 sm:h-16 rounded-xl border-2 border-dashed flex items-center justify-center text-2xl font-bold transition-colors select-none",
              card
                ? "bg-primary/10 border-primary text-primary cursor-pointer"
                : dragOverSlot === i
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted"
            )}
          >
            {card?.letter || ""}
          </div>
        ))}
      </div>

      {/* 待选字母区域 */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {letters.map((card) => (
          <div
            key={card.id}
            onPointerDown={(e) => handlePointerDown(card.id, e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={cn(
              "w-12 h-14 sm:w-14 sm:h-16 rounded-xl bg-card border-2 border-border flex items-center justify-center text-2xl font-bold cursor-grab active:cursor-grabbing select-none transition-all touch-none",
              dragging === card.id
                ? "scale-110 shadow-lg border-primary opacity-70"
                : "hover:border-primary hover:shadow-md"
            )}
          >
            {card.letter}
          </div>
        ))}
      </div>

      {/* 错误计数提示 */}
      {consecutiveErrors > 0 && consecutiveErrors < maxErrors && (
        <p className="text-center text-sm text-error">
          已连续错误 {consecutiveErrors}/{maxErrors} 次
        </p>
      )}
    </div>
  )
}
