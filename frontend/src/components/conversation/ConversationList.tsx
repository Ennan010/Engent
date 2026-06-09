import { List } from 'react-window'
import type { ConversationRowProps } from './ConversationRow'
import ConversationRow, { CONVERSATION_ROW_HEIGHT } from './ConversationRow'

interface ConversationListProps {
  conversations: ConversationRowProps['conversations']
  activeId: string | null
  onSelect: ConversationRowProps['onSelect']
  onDelete: ConversationRowProps['onDelete']
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <p className="px-5 pt-3 text-xs font-medium uppercase tracking-wide text-gray-400">会话</p>
        <p className="flex flex-1 items-center justify-center px-4 text-sm text-gray-400">
          暂无会话
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 px-5 pt-3 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        会话
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
    </div>
  )
}
