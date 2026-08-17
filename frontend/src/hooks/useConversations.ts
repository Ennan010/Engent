import { useCallback, useEffect, useRef, useState } from 'react'
import type { Conversation } from '../types/conversation'
import * as conversationApi from '../api/conversations'

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const conversationsRef = useRef<Conversation[]>([])

  // 首次加载会话列表
  useEffect(() => {
    let cancelled = false
    conversationApi
      .fetchConversations()
      .then((list) => {
        if (cancelled) return
        setConversations(list)
        setActiveId((current) => current ?? list[0]?.id ?? null)
      })
      .catch((err) => console.error('加载会话列表失败:', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const selectConversation = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await conversationApi.deleteConversation(id)
    } catch (err) {
      console.error('删除会话失败:', err)
      return
    }
    const next = conversationsRef.current.filter((item) => item.id !== id)
    setConversations(next)
    setActiveId((current) => (current === id ? (next[0]?.id ?? null) : current))
  }, [])

  const createConversation = useCallback(async () => {
    const conversation = await conversationApi.createConversation()
    setConversations((prev) => [conversation, ...prev])
    setActiveId(conversation.id)
    return conversation
  }, [])

  /** 首条消息后将会话标题同步为消息内容（仅在仍为默认标题时生效） */
  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((item) => (item.id === id && item.title === '新对话' ? { ...item, title } : item)),
    )
  }, [])

  return {
    conversations,
    activeId,
    loading,
    selectConversation,
    deleteConversation,
    createConversation,
    updateConversationTitle,
  }
}
