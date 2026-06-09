import { useState, type FormEvent, type KeyboardEvent } from 'react'
import Button from '../ui/Button'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')

  const submit = () => {
    if (!value.trim() || disabled) return
    onSend(value)
    setValue('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-gray-100 bg-white px-4 py-3"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          rows={1}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none disabled:opacity-60"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={disabled || !value.trim()}
          className="shrink-0 border-transparent enabled:!bg-gray-900 enabled:!text-white enabled:hover:!bg-gray-800 enabled:hover:!text-white enabled:active:!bg-gray-950 disabled:!bg-gray-100 disabled:!text-gray-400 disabled:opacity-100"
        >
          发送
        </Button>
      </div>
    </form>
  )
}
