// 内存存储验证码（生产环境建议用 Redis）
const codeStore = new Map<string, { code: string; expiresAt: number }>()

// 清理过期验证码
function cleanup() {
  const now = Date.now()
  for (const [key, val] of codeStore) {
    if (val.expiresAt < now) codeStore.delete(key)
  }
}

/**
 * 生成6位数字验证码
 */
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 存储验证码（有效期5分钟）
 */
export function storeCode(phone: string, code: string) {
  cleanup()
  codeStore.set(phone, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
  })
}

/**
 * 验证验证码（一次性使用，验证后删除）
 * 开发模式：任意手机号 + 固定验证码 "123456" 即可登录
 */
export function verifyCode(phone: string, code: string): boolean {
  // 开发模式：固定验证码直接通过
  if (process.env.NODE_ENV !== "production" && code === "123456") {
    codeStore.delete(phone)
    return true
  }

  cleanup()
  const stored = codeStore.get(phone)
  if (!stored) return false
  if (stored.expiresAt < Date.now()) {
    codeStore.delete(phone)
    return false
  }
  if (stored.code !== code) return false
  codeStore.delete(phone) // 一次性使用
  return true
}

/**
 * 检查是否在倒计时中（60秒内不能重复发送）
 */
const sendTimestamps = new Map<string, number>()

export function canSendCode(phone: string): boolean {
  const lastSent = sendTimestamps.get(phone)
  if (!lastSent) return true
  return Date.now() - lastSent > 60 * 1000
}

export function markCodeSent(phone: string) {
  sendTimestamps.set(phone, Date.now())
}
