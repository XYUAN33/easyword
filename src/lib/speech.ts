/**
 * 语音合成工具
 * 单词用预生成 MP3，字母用本地缓存 MP3，兜底用浏览器 TTS
 */

let voices: SpeechSynthesisVoice[] = []

function loadVoices() {
  if (typeof window === "undefined") return
  voices = window.speechSynthesis.getVoices()
}

if (typeof window !== "undefined") {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

function getEnglishVoice(): SpeechSynthesisVoice | null {
  return voices.find((v) => v.lang.startsWith("en")) || voices[0] || null
}

// ==================== 字母音频缓存（客户端） ====================

const letterCache: Map<string, HTMLAudioElement> = new Map()

/**
 * 预加载26个字母的音频到内存
 */
export function preloadLetters() {
  if (typeof window === "undefined") return
  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    if (letterCache.has(letter)) continue
    const audio = new Audio(`/audio/letters/${letter}.mp3`)
    audio.preload = "auto"
    audio.load()
    letterCache.set(letter, audio)
  }
}

/**
 * 播放缓存的字母音频，返回 Promise
 */
function playLetter(letter: string): Promise<void> {
  const l = letter.toLowerCase()
  const cached = letterCache.get(l)
  if (!cached) {
    // 降级到浏览器 TTS
    return speakBrowser(l, 1.2)
  }

  // 克隆 Audio 节点以支持快速连续播放
  const clone = cached.cloneNode() as HTMLAudioElement
  clone.volume = 1

  return new Promise((resolve) => {
    clone.onended = () => resolve()
    clone.onerror = () => resolve()
    clone.play().catch(() => resolve())
  })
}

// ==================== 通用播放 ====================

function playAudio(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(false); return }
    const audio = new Audio(url)
    audio.onended = () => resolve(true)
    audio.onerror = () => resolve(false)
    audio.play().catch(() => resolve(false))
  })
}

function speakBrowser(text: string, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = getEnglishVoice()
    if (voice) utterance.voice = voice
    utterance.lang = "en-US"
    utterance.rate = rate
    utterance.pitch = 1.1
    utterance.volume = 1
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

/**
 * 朗读英文文本（单词用预生成 MP3，字母自动走缓存）
 */
export async function speak(
  text: string,
  rate = 0.8,
  audioUrl?: string | null
): Promise<void> {
  if (audioUrl) {
    const played = await playAudio(audioUrl)
    if (played) return
  }
  await speakBrowser(text, rate)
}

/**
 * 逐字母拼读单词（使用本地缓存字母音频，200ms间隔，不阻塞）
 */
export async function spellWord(word: string, letterDelay = 700): Promise<void> {
  for (const letter of word) {
    playLetter(letter) // 不 await，字母音频快速连续播放
    await new Promise((r) => setTimeout(r, letterDelay))
  }
  await new Promise((r) => setTimeout(r, 300))
  await speak(word, 0.7)
}
