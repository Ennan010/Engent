import type { RowComponentProps } from 'react-window'
import type { Conversation } from '../../types/conversation'

export const CONVERSATION_ROW_HEIGHT = 48

export interface ConversationRowProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function DeleteIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
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
        className={`flex h-10 items-center gap-1 rounded-lg px-2 ${
          isActive ? 'bg-white shadow-sm' : 'hover:bg-white/70'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(conversation.id)}
          className="min-w-0 flex-1 truncate text-left text-sm text-gray-900"
        >
          {conversation.title}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(conversation.id)
          }}
          aria-label={`删除${conversation.title}`}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  )
}
