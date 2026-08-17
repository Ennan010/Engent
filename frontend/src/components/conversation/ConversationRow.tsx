import type { RowComponentProps } from 'react-window'
import type { Conversation } from '../../types/conversation'

export const CONVERSATION_ROW_HEIGHT = 52

export interface ConversationRowProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

function ChatIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 8.25h9m-9 3H12m-4.5 3H12M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function ConversationRow({
  index,
  style,
  ariaAttributes,
  conversations,
  activeId,
  onSelect,
  onDelete,
}: RowComponentProps<ConversationRowProps>) {
  const conversation = conversations[index]
  if (!conversation) return null

  const isActive = conversation.id === activeId

  return (
    <div style={style} {...ariaAttributes} className="px-2">
      <div
        className={cn(
          'group flex h-11 items-center gap-2 rounded-xl px-2 transition-colors ',
          isActive
            ? 'bg-gray-900 text-white shadow-sm'
            : 'text-gray-700  hover:bg-gray-200/60 hover:text-gray-900',
        )}
      >
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg',
            isActive ? 'bg-white/15 text-white' : 'bg-gray-200/70 text-gray-500',
          )}
          aria-hidden="true"
        >
          <ChatIcon />
        </div>

        <button
          type="button"
          onClick={() => onSelect(conversation.id)}
          title={conversation.title}
          className="block min-w-0 flex-1 overflow-hidden text-left text-sm font-medium"
        >
          <span className="block truncate">{conversation.title}</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(conversation.id)
          }}
          aria-label={`删除${conversation.title}`}
          className={cn(
            'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-all focus-visible:opacity-100',
            isActive
              ? 'text-white/70 hover:bg-white/20 hover:text-white group-hover:opacity-100'
              : 'text-gray-400 hover:bg-gray-300 hover:text-red-600 group-hover:opacity-100',
          )}
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  )
}
