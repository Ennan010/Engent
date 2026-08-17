import type { ReactNode } from 'react'
import { ConversationContext } from './conversationContext'
import { useConversations } from '../hooks/useConversations'

export function ConversationProvider({ children }: { children: ReactNode }) {
  const value = useConversations()
  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>
}
