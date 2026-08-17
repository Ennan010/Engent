import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message } from '../types/chat'
import type { Conversation } from '../types/conversation'
import * as messageApi from '../api/messages'

/**
 * 生成消息临时 ID（优先 crypto.randomUUID；非安全上下文 / 旧浏览器回退到随机串，
 * 避免因 randomUUID 抛错导致乐观消息无法上屏）
 */
function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 聊天逻辑 Hook（已对接后端 API）：
 * - conversationId 变化时加载历史消息
 * - 无会话时发送消息会先创建会话再发送
 * - 乐观更新：先显示本地用户消息，响应返回后替换为服务器数据
 */
export function useChat(
  conversationId: string | null,
  createConversation: () => Promise<Conversation>,
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const conversationIdRef = useRef(conversationId)
  const requestSeq = useRef(0)
  // 正在发送消息的目标会话 ID，用于避免加载请求覆盖乐观消息
  const pendingSendRef = useRef<string | null>(null)

  // 渲染后同步最新会话 ID，供异步回调判断用户是否已切换会话
  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  // 切换会话时加载消息（请求序号作废在途请求，避免竞态覆盖）
  useEffect(() => {
    const seq = ++requestSeq.current
    const load = async () => {
      if (!conversationId) {
        setMessages([])
        return
      }
      try {
        const list = await messageApi.fetchMessages(conversationId)
        if (seq !== requestSeq.current) return
        // 消息发送期间跳过覆盖，避免把乐观消息清空（发送完成后会写入完整结果）
        if (pendingSendRef.current === conversationId) return
        setMessages(list)
      } catch (err) {
        console.error('加载消息失败:', err)
      }
    }
    void load()
    return () => {
      requestSeq.current += 1
    }
  }, [conversationId])

  const sendMessage = useCallback(
    async (
      content: string,
    ): Promise<{ userMessage: Message; assistantMessage: Message } | null> => {
      const trimmed = content.trim()
      if (!trimmed || isLoading) return null

      const optimisticMessage: Message = {
        id: createLocalId(),
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      // AI 回复占位消息：内容随 SSE 增量逐块填充
      const assistantId = createLocalId()
      const assistantPlaceholder: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        streaming: true,
      }

      setMessages((prev) => [...prev, optimisticMessage, assistantPlaceholder])
      setIsLoading(true)

      try {
        // 尚无会话时先创建
        let targetId = conversationIdRef.current
        if (!targetId) {
          const conversation = await createConversation()
          targetId = conversation.id
        }

        pendingSendRef.current = targetId
        let streamError: string | null = null
        let doneResult: { userMessage: Message; assistantMessage: Message } | null = null

        await messageApi.streamSendMessage(targetId, trimmed, {
          onDelta: (delta) => {
            // 用户已切换会话则丢弃增量
            if (conversationIdRef.current !== targetId) return
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
            )
          },
          onDone: (result) => {
            doneResult = result
          },
          onError: (message) => {
            streamError = message
          },
        })
        pendingSendRef.current = null

        // 用户已切换会话则丢弃本次结果
        if (conversationIdRef.current !== targetId) return null

        // 流式期间后端出错：保留用户消息，展示失败提示
        if (streamError) {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== assistantId && m.id !== optimisticMessage.id),
            {
              id: createLocalId(),
              role: 'assistant',
              content: `消息发送失败，请稍后重试。（${streamError}）`,
              createdAt: new Date().toISOString(),
              error: true,
            },
          ])
          return null
        }

        // 正常完成：作废在途加载请求，替换占位消息为后端持久化结果
        requestSeq.current += 1
        setMessages((prev) => {
          // 去掉用户乐观消息；若加载请求已把后端保存的同一用户消息写入，也一并去重
          const rest = prev.filter(
            (m) =>
              m.id !== optimisticMessage.id && !(m.role === 'user' && m.content === trimmed),
          )
          if (doneResult) {
            return [
              ...rest.filter((m) => m.id !== assistantId),
              doneResult.userMessage,
              doneResult.assistantMessage,
            ]
          }
          // 后端未回传完成事件（异常兜底）：保留已生成内容，去掉流式标记
          return rest.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
        })
        return doneResult
      } catch (err) {
        console.error('发送消息失败:', err)
        pendingSendRef.current = null
        // 超时错误给出更友好的提示
        const isTimeout = err instanceof Error && err.name === 'TimeoutError'
        const detail = isTimeout ? '请求超时' : err instanceof Error ? err.message : ''
        // 保留用户消息，并追加一条失败提示，避免消息「消失」且无任何反馈
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== assistantId && m.id !== optimisticMessage.id),
          {
            id: createLocalId(),
            role: 'assistant',
            content: detail
              ? `消息发送失败，请稍后重试。（${detail}）`
              : '消息发送失败，请稍后重试。',
            createdAt: new Date().toISOString(),
            error: true,
          },
        ])
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, createConversation],
  )

  return { messages, sendMessage, isLoading }
}
