import { useCallback } from 'react'
import ChatInput from '../components/chat/ChatInput'
import MessageList from '../components/chat/MessageList'
import { useChat } from '../hooks/useChat'
import { useConversationsContext } from '../context/useConversationsContext'

export default function ChatPage() {
  const { activeId, createConversation, updateConversationTitle } =
    useConversationsContext()
  const { messages, sendMessage, isLoading } = useChat(activeId, createConversation)

  const handleSend = useCallback(
    async (content: string) => {
      const result = await sendMessage(content)
      if (!result) return
      // 会话标题仍为默认值时，同步为首条消息内容（与后端逻辑一致）
      const { conversationId } = result.userMessage
      if (conversationId) {
        updateConversationTitle(conversationId, content.trim().slice(0, 30))
      }
    },
    [sendMessage, updateConversationTitle],
  )

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} isLoading={isLoading} onSuggestion={(text) => void handleSend(text)} />
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  )
}
