import { useEffect, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { useGuard } from '@authing/guard-react18'
import type { User } from '@authing/guard-react18'
import ConversationList from './conversation/ConversationList'
import Button from './ui/Button'
import { useConversations } from '../hooks/useConversations'

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

function MenuIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function PanelIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M15 3v18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function DrawerBackdrop({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <button
      type="button"
      aria-label="关闭面板"
      className="fixed inset-0 z-40 bg-black/40 lg:hidden"
      onClick={onClose}
    />
  )
}

function MobileDrawer({
  open,
  onClose,
  side,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  side: 'left' | 'right'
  title: string
  children: ReactNode
}) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 z-50 flex w-[min(85vw,18rem)] flex-col bg-gray-50 shadow-xl transition-transform duration-300 ease-out lg:hidden',
        side === 'left' ? 'left-0' : 'right-0',
        open
          ? 'translate-x-0'
          : side === 'left'
            ? '-translate-x-full'
            : 'translate-x-full',
      )}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭" className="px-2">
          <CloseIcon />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </aside>
  )
}

function SidebarUser({
  displayName,
  avatarLetter,
  email,
  onLogout,
}: {
  displayName: string
  avatarLetter: string
  email?: string | null
  onLogout: () => void
}) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-3 rounded-xl bg-white p-2 shadow-sm">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-medium text-white"
          aria-hidden="true"
        >
          {avatarLetter}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
          {email && <p className="truncate text-xs text-gray-500">{email}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} className="shrink-0 px-2">
          退出
        </Button>
      </div>
    </div>
  )
}

function ToolPanel() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">详情</p>
      {/* 后续可替换为上下文面板组件 */}
    </div>
  )
}

export default function AppLayout() {
  const guard = useGuard()
  const [user, setUser] = useState<User | null>(null)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const { conversations, activeId, selectConversation, deleteConversation } = useConversations()

  useEffect(() => {
    guard.trackSession().then(setUser)
  }, [guard])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      if (mq.matches) {
        setLeftOpen(false)
        setRightOpen(false)
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLeftOpen(false)
        setRightOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    document.body.style.overflow = leftOpen || rightOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [leftOpen, rightOpen])

  const handleLogout = async () => {
    await guard.logout({
      redirectUri: `${window.location.origin}/login`,
    })
  }

  const displayName = user?.nickname || user?.username || '用户'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* 桌面端左栏 */}
      <aside className="hidden w-64 shrink-0 flex-col bg-gray-50 lg:flex">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onDelete={deleteConversation}
        />
        <SidebarUser
          displayName={displayName}
          avatarLetter={avatarLetter}
          email={user?.email}
          onLogout={handleLogout}
        />
      </aside>

      {/* 移动端左栏抽屉 */}
      <DrawerBackdrop open={leftOpen} onClose={() => setLeftOpen(false)} />
      <MobileDrawer open={leftOpen} onClose={() => setLeftOpen(false)} side="left" title="会话">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => {
            selectConversation(id)
            setLeftOpen(false)
          }}
          onDelete={deleteConversation}
        />
        <SidebarUser
          displayName={displayName}
          avatarLetter={avatarLetter}
          email={user?.email}
          onLogout={handleLogout}
        />
      </MobileDrawer>

      {/* 中栏：对话区，设置最小宽度 */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden lg:min-w-[22rem]">
        <div className="flex shrink-0 items-center justify-between px-2 py-1 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRightOpen(false)
              setLeftOpen(true)
            }}
            aria-label="打开会话列表"
            className="px-2"
          >
            <MenuIcon />
          </Button>
          <span className="truncate text-sm font-medium text-gray-700">对话</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLeftOpen(false)
              setRightOpen(true)
            }}
            aria-label="打开工具面板"
            className="px-2"
          >
            <PanelIcon />
          </Button>
        </div>

        <div className="min-h-0 min-w-0 flex-1">
          <Outlet />
        </div>
      </main>

      {/* 桌面端右栏 */}
      <aside className="hidden w-72 shrink-0 flex-col bg-gray-50 lg:flex">
        <ToolPanel />
      </aside>

      {/* 移动端右栏抽屉 */}
      <DrawerBackdrop open={rightOpen} onClose={() => setRightOpen(false)} />
      <MobileDrawer open={rightOpen} onClose={() => setRightOpen(false)} side="right" title="工具">
        <ToolPanel />
      </MobileDrawer>
    </div>
  )
}
