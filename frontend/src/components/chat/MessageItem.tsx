import type { Message } from '../../types/chat'
import MarkdownContent from './MarkdownContent'

/** 流式生成中的打字光标 */
function TypingCursor() {
  return <span className="ml-0.5 inline-block h-4 w-[3px] animate-pulse rounded-sm bg-gray-500 align-middle" />
}

export default function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  // 仅对正常回复做 markdown 渲染；用户输入与错误提示保持纯文本
  const renderMarkdown = !isUser && !message.error

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
          message.error
            ? 'border border-red-200 bg-red-50 text-red-600'
            : isUser
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-900'
        }`}
      >
        {renderMarkdown ? (
          <div className="min-w-0">
            <MarkdownContent content={message.content} />
            {message.streaming && <TypingCursor />}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">
            {message.content}
            {message.streaming && <TypingCursor />}
          </p>
        )}
      </div>
    </div>
  )
}
