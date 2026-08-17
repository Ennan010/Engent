import { useEffect, useRef } from 'react'
import type { Message } from '../../types/chat'
import MessageItem from './MessageItem'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  /** 空会话时点击建议问题，直接发送 */
  onSuggestion?: (text: string) => void
}

const SUGGESTIONS = [
  '帮我用 TypeScript 写一个防抖 Hook',
  '解释一下向量数据库的检索原理',
  '总结 React 与 Vue 的核心区别',
]

function Welcome({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 pb-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gray-900 text-2xl font-bold text-white shadow-lg shadow-gray-900/10">
        E
      </div>
      <h1 className="mt-5 text-xl font-semibold text-gray-900">你好，我是 Engent</h1>
      <p className="mt-1.5 text-sm text-gray-500">上传文档或直接提问，我会结合你的知识库为你解答</p>

      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition-all hover:-translate-y-px hover:border-gray-300 hover:shadow-md active:translate-y-0"
          >
            <span className="line-clamp-2">{s}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function MessageList({ messages, onSuggestion }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // 消息（含流式增量）更新时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex h-full max-w-3xl flex-col">
          <Welcome onSuggestion={onSuggestion ?? (() => {})} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
