import { createContext } from 'react'
import type { Conversation } from '../types/conversation'

export interface ConversationContextValue {
  conversations: Conversation[]
  activeId: string | null
  /** 会话列表是否加载中 */
  loading: boolean
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => Promise<void>
  createConversation: () => Promise<Conversation>
  updateConversationTitle: (id: string, title: string) => void
}

export const ConversationContext = createContext<ConversationContextValue | null>(null)
