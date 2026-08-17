import { useContext } from 'react'
import { ConversationContext } from './conversationContext'

export function useConversationsContext() {
  const ctx = useContext(ConversationContext)
  if (!ctx) {
    throw new Error('useConversationsContext 必须在 ConversationProvider 内使用')
  }
  return ctx
}
