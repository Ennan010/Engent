import { useCallback, useState } from 'react'
import type { Message } from '../types/chat'

const MOCK_MESSAGE: Message = {
  id: 'mock-1',
  role: 'assistant',
  content: '你好，我是 Engent，有什么可以帮你的？',
  createdAt: new Date(),
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([MOCK_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    await new Promise((resolve) => setTimeout(resolve, 600))

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `收到你的消息：「${trimmed}」。后端接入后将在这里返回 Agent 回复。`,
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, assistantMessage])
    setIsLoading(false)
  }, [isLoading])

  return { messages, sendMessage, isLoading }
}
