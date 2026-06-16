/**
 * 短信发送服务
 *
 * 当前为开发模式（仅在控制台打印验证码）
 * 生产环境接入阿里云/腾讯云 SMS 后，替换 sendCode 函数即可
 */

export interface SmsProvider {
  send(phone: string, code: string): Promise<boolean>
}

/**
 * 开发模式：控制台打印验证码（不实际发送短信）
 */
class DevSmsProvider implements SmsProvider {
  async send(phone: string, code: string): Promise<boolean> {
    console.log(`[DEV SMS] 向 ${phone} 发送验证码: ${code}`)
    return true
  }
}

/**
 * 阿里云短信（TODO: 生产环境实现）
 * 需要安装: @alicloud/dysmsapi20170525, @alicloud/openapi-client
 *
 * class AliyunSmsProvider implements SmsProvider {
 *   async send(phone: string, code: string): Promise<boolean> {
 *     // 调用阿里云 SendSms API
 *     // AccessKeyId, AccessKeySecret, SignName, TemplateCode 从环境变量读取
 *   }
 * }
 */

// 当前使用开发模式
const smsProvider: SmsProvider = new DevSmsProvider()

export async function sendSmsCode(phone: string, code: string): Promise<boolean> {
  return smsProvider.send(phone, code)
}
