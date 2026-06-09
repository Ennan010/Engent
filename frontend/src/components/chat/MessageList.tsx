import { useEffect, useRef } from 'react'
import type { Message } from '../../types/chat'
import MessageItem from './MessageItem'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
              正在思考…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
