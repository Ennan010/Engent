export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string
  /** ISO 时间字符串（后端返回格式） */
  createdAt: string
  /** 所属会话 ID（后端返回，用于会话标题同步等） */
  conversationId?: string
  /** 本地生成的失败提示消息标记 */
  error?: boolean
  /** 流式生成中的本地占位消息标记（内容随 SSE 增量逐块填充） */
  streaming?: boolean
}
