import ChatInput from '../components/chat/ChatInput'
import MessageList from '../components/chat/MessageList'
import { useChat } from '../hooks/useChat'

export default function ChatPage() {
  const { messages, sendMessage, isLoading } = useChat()

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}
