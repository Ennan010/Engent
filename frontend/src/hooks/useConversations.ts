import { useCallback, useState } from 'react'
import type { Conversation } from '../types/conversation'

function createMockConversations(count = 50000): Conversation[] {  //会话总数
  return Array.from({ length: count }, (_, index) => ({
    id: `conv-${index + 1}`,
    title: `会话 ${index + 1}`,
  }))
}

export function useConversations() {
  const [initialConversations] = useState(() => createMockConversations())
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [activeId, setActiveId] = useState<string | null>(
    () => initialConversations[0]?.id ?? null,
  )

  const selectConversation = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((item) => item.id !== id)
      setActiveId((current) => {
        if (current !== id) return current
        return next[0]?.id ?? null
      })
      return next
    })
  }, [])

  return {
    conversations,
    activeId,
    selectConversation,
    deleteConversation,
  }
}