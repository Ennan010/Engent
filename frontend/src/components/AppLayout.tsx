import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { clearToken } from '../api/token'
import { http } from '../api/http'
import ConversationList from './conversation/ConversationList'
import Button from './ui/Button'
import KnowledgePanel from './knowledge/KnowledgePanel'
import { ConversationProvider } from '../context/ConversationProvider'
import { KnowledgeProvider } from '../context/KnowledgeProvider'
import { useKnowledgeContext } from '../context/useKnowledgeContext'
import { useConversationsContext } from '../context/useConversationsContext'

/** Authing userinfo 返回的用户信息（后端代理 /api/auth/me） */
interface AuthUser {
  sub?: string
  name?: string | null
  nickname?: string | null
  username?: string | null
  preferred_username?: string | null
  email?: string | null
  phone_number?: string | null
  picture?: string | null
  avatar?: string | null
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

/** 从 Guard 缓存的 _authing_user 中读取登录账号（Guard 登录成功时会写入 localStorage） */
function getLocalUsername(): string | null {
  try {
    const raw = localStorage.getItem('_authing_user')
    if (!raw) return null
    const data = JSON.parse(raw) as { username?: unknown }
    return typeof data.username === 'string' && data.username.trim()
      ? data.username.trim()
      : null
  } catch {
    return null
  }
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

function UploadIcon() {
  return (
    <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
      />
    </svg>
  )
}

/** 全局拖拽遮罩：将文件拖入页面任意位置时展示，松开即可上传到知识库 */
function GlobalDropOverlay() {
  const { uploadFiles } = useKnowledgeContext()
  const [visible, setVisible] = useState(false)
  const depthRef = useRef(0)

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depthRef.current += 1
      setVisible(true)
    }

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      // 拖出浏览器窗口时 relatedTarget 为 null
      if (!e.relatedTarget) {
        depthRef.current = 0
        setVisible(false)
        return
      }
      depthRef.current = Math.max(0, depthRef.current - 1)
      if (depthRef.current === 0) setVisible(false)
    }

    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depthRef.current = 0
      setVisible(false)
      // 落在知识库面板内部时由面板自行处理，避免重复上传
      const target = e.target as HTMLElement | null
      if (target?.closest?.('[data-knowledge-panel]')) return
      const files = e.dataTransfer?.files
      if (files && files.length > 0) void uploadFiles(files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [uploadFiles])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-900/50 bg-white/90 px-12 py-10 text-center shadow-xl">
        <span className="text-gray-900">
          <UploadIcon />
        </span>
        <p className="text-base font-semibold text-gray-900">松开鼠标，上传到知识库</p>
        <p className="text-xs text-gray-500">支持 PDF / MD / TXT / DOCX，单个 20MB 以内，可一次拖入多个文件</p>
      </div>
    </div>
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
  children,
}: {
  open: boolean
  onClose: () => void
  side: 'left' | 'right'
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
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭面板"
        className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-900"
      >
        <CloseIcon />
      </button>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </aside>
  )
}

function LogoutIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-7.5A2.25 2.25 0 003.75 5.25v13.5A2.25 2.25 0 006 21h7.5a2.25 2.25 0 002.25-2.25V15M12 12h8.25m0 0l-3-3m3 3l-3 3"
      />
    </svg>
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
    <div className="shrink-0 border-t border-gray-200/60 p-3">
      <div className="flex items-center gap-2.5">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
          aria-hidden="true"
        >
          {avatarLetter}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
          {email && <p className="truncate text-xs text-gray-400">{email}</p>}
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="退出登录"
          title="退出登录"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-red-600"
        >
          <LogoutIcon />
        </button>
      </div>
    </div>
  )
}



export default function AppLayout() {
  return (
    <KnowledgeProvider>
      <ConversationProvider>
        <LayoutContent />
      </ConversationProvider>
    </KnowledgeProvider>
  )
}

function LayoutContent() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const { conversations, activeId, selectConversation, deleteConversation, createConversation } =
    useConversationsContext()

  useEffect(() => {
    // 通过后端代理获取当前登录用户（不再依赖 Guard trackSession 的跨域会话）
    http
      .get<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

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

  const handleLogout = () => {
    // 1. 先清除本地凭证（本应用 token）
    clearToken()
    // 2. 跳转 Authing 登出端点，清除 Authing 域名下的会话 cookie。
    //    否则回到 /login 后 startWithRedirect 会发现 Authing 已登录 → 自动登录跳回，
    //    导致“退出不了、总是自动登录”。
    //    注意：redirect_uri 需在 Authing 控制台「应用配置 → 登出回调 URL」白名单中，
    //    否则该地址登出后无法自动跳回（可在控制台将站点登录页加入白名单）。
    const siteOrigin = window.location.origin
    const logoutUrl = `https://engent.authing.cn/login/profile/logout?redirect_uri=${encodeURIComponent(`${siteOrigin}/login`)}`
    window.location.href = logoutUrl
  }

  // 用户名：Authing 用户可能未设置姓名（name/nickname 为空），
  // 依次回退到登录账号（preferred_username）、本地缓存的 _authing_user.username、
  // 邮箱、手机号，最后才是占位符
  const displayName =
    user?.name ||
    user?.nickname ||
    user?.preferred_username ||
    user?.username ||
    getLocalUsername() ||
    user?.email ||
    user?.phone_number ||
    '用户'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* 桌面端左栏 */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200/60 bg-gray-50 lg:flex">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onDelete={deleteConversation}
          onCreate={createConversation}
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
      <MobileDrawer open={leftOpen} onClose={() => setLeftOpen(false)} side="left">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => {
            selectConversation(id)
            setLeftOpen(false)
          }}
          onDelete={deleteConversation}
          onCreate={() => {
            void createConversation()
            setLeftOpen(false)
          }}
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
      <aside className="hidden w-72 shrink-0 flex-col border-l border-gray-200/60 bg-gray-50 lg:flex">
        <KnowledgePanel />
      </aside>

      {/* 移动端右栏抽屉 */}
      <DrawerBackdrop open={rightOpen} onClose={() => setRightOpen(false)} />
      <MobileDrawer open={rightOpen} onClose={() => setRightOpen(false)} side="right">
        <KnowledgePanel />
      </MobileDrawer>

      {/* 全局拖拽上传遮罩 */}
      <GlobalDropOverlay />
    </div>
  )
}
