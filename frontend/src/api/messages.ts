import { http } from './http'
import { clearToken, getToken } from './token'
import type { Message } from '../types/chat'

/** 获取会话消息列表（按时间正序） */
export const fetchMessages = (conversationId: string) =>
  http.get<Message[]>(`/conversations/${conversationId}/messages`)

/** 发送消息（非流式：后端返回用户消息与 AI 回复） */
export const sendMessage = (conversationId: string, content: string) =>
  http.post<{ userMessage: Message; assistantMessage: Message }>(
    `/conversations/${conversationId}/messages`,
    { content },
    // AI 生成可能较慢，单独放宽超时时间
    { timeout: 120000 },
  )

/** SSE 流式发送的事件回调 */
export interface StreamHandlers {
  /** 收到一段增量文本 */
  onDelta: (delta: string) => void
  /** 流式生成完成，携带后端持久化的用户消息与 AI 回复 */
  onDone: (result: { userMessage: Message; assistantMessage: Message }) => void
  /** 出错（错误信息可读） */
  onError: (message: string) => void
}

/**
 * 发送消息（SSE 流式）：AI 回复逐块返回，通过 onDelta 增量渲染。
 * 用原生 fetch 读取响应流，后端事件格式：data: {JSON}\n\n
 *   { delta: string }                            生成中的一段增量文本
 *   { done: true, userMessage, assistantMessage } 生成完成
 *   { error: string }                             LLM 或保存失败
 */
export async function streamSendMessage(
  conversationId: string,
  content: string,
  handlers: StreamHandlers,
): Promise<void> {
  const token = getToken()
  const response = await fetch(`/api/conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
    // 兜底超时：后端无响应或流中断时中止，避免界面永久卡住
    signal: AbortSignal.timeout(180_000),
  })

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      // 忽略响应体解析失败
    }
    if (response.status === 401) {
      clearToken()
      window.location.href = '/login'
    }
    handlers.onError(detail || `请求失败（HTTP ${response.status}）`)
    return
  }
  if (!response.body) {
    handlers.onError('当前浏览器不支持流式响应')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE 事件以空行分隔
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        for (const line of event.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (!data) continue
          try {
            const parsed = JSON.parse(data) as {
              delta?: string
              done?: boolean
              userMessage?: Message
              assistantMessage?: Message
              error?: string
            }
            if (typeof parsed.delta === 'string') handlers.onDelta(parsed.delta)
            if (parsed.done && parsed.userMessage && parsed.assistantMessage) {
              handlers.onDone({
                userMessage: parsed.userMessage,
                assistantMessage: parsed.assistantMessage,
              })
            }
            if (parsed.error) handlers.onError(parsed.error)
          } catch {
            // 忽略无法解析的数据行
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
