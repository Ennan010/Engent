import { List } from 'react-window'
import type { ConversationRowProps } from './ConversationRow'
import ConversationRow, { CONVERSATION_ROW_HEIGHT } from './ConversationRow'

interface ConversationListProps {
  conversations: ConversationRowProps['conversations']
  activeId: string | null
  onSelect: ConversationRowProps['onSelect']
  onDelete: ConversationRowProps['onDelete']
  onCreate: () => void
}

function PlusIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ChatBubbleIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337L5.25 21l1.087-2.587A8.472 8.472 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    </svg>
  )
}

function Logo() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white shadow-sm">
      E
    </div>
  )
}

function SidebarHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="shrink-0 border-b border-gray-200/60 px-4 py-3">
      <div className="mb-3 flex items-center gap-2.5">
        <Logo />
        <span className="text-base font-semibold text-gray-900">Engent</span>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-medium shadow-sm transition-all hover:bg-gray-300 hover:shadow active:scale-[0.98] active:bg-gray-950"
      >
        <PlusIcon />
        新建对话
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-8 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
        <ChatBubbleIcon />
      </div>
      <p className="text-sm font-medium text-gray-900">还没有会话</p>
      <p className="mt-1 text-xs text-gray-500">点击上方按钮开始新的对话</p>
    </div>
  )
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onCreate,
}: ConversationListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SidebarHeader onCreate={onCreate} />

      {conversations.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <p className=" shrink-0 px-4 pb-2 pt-3 text-xs font-medium text-gray-400">
            历史会话
          </p>
          <div className="min-h-0 flex-1">
            <List
              rowComponent={ConversationRow}
              rowCount={conversations.length}
              rowHeight={CONVERSATION_ROW_HEIGHT}
              rowProps={{ conversations, activeId, onSelect, onDelete }}
              overscanCount={8}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </>
      )}
    </div>
  )
}
