import { useRef, useState } from 'react'
import { useKnowledgeContext } from '../../context/useKnowledgeContext'
import type { KnowledgeDocument } from '../../types/document'

const ACCEPT_TYPES = '.pdf,.md,.markdown,.txt,.text,.docx'

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

/** 文件大小格式化 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 类型徽章样式 */
const typeBadge: Record<string, string> = {
  pdf: 'bg-red-50 text-red-600',
  md: 'bg-blue-50 text-blue-600',
  txt: 'bg-gray-100 text-gray-600',
  docx: 'bg-emerald-50 text-emerald-600',
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
        typeBadge[type] ?? 'bg-gray-100 text-gray-500',
      )}
    >
      {type}
    </span>
  )
}

function UploadIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m1 0v11a2 2 0 01-2 2H8a2 2 0 01-2-2V7"
      />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg className="size-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
      />
      <path strokeLinecap="round" d="M14 3v5h5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function DocumentRow({ doc }: { doc: KnowledgeDocument }) {
  const { removeDocument } = useKnowledgeContext()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    await removeDocument(doc.id)
    setDeleting(false)
  }

  return (
    <li className="group flex items-start gap-2 rounded-lg bg-white p-2 shadow-sm">
      <FileIcon />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-gray-900">{doc.name}</p>
          <TypeBadge type={doc.type} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
          <span>{formatSize(doc.size)}</span>
          {doc.status === 'ready' && <span>· {doc.chunkCount} 块</span>}
          {doc.status === 'processing' && (
            <span className="flex items-center gap-1 text-amber-500">
              <span className="size-3 animate-spin rounded-full border-2 border-amber-300 border-t-amber-500" />
              处理中
            </span>
          )}
          {doc.status === 'failed' && <span className="text-red-500">处理失败</span>}
        </div>
        {doc.status === 'failed' && doc.error && (
          <p className="mt-0.5 line-clamp-2 text-xs text-red-400" title={doc.error}>
            {doc.error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label={`删除 ${doc.name}`}
        className="shrink-0 rounded p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-red-500 disabled:opacity-40"
      >
        <TrashIcon />
      </button>
    </li>
  )
}

/** 右侧栏知识库面板：上传文档 → 向量化入库，供聊天 RAG 检索 */
export default function KnowledgePanel() {
  const { documents, loading, uploading, queue, error, uploadFiles, clearError } = useKnowledgeContext()
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // 拖拽进出子元素会触发多次 enter/leave，用计数器判断整体是否仍在面板内
  const dragDepth = useRef(0)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // 移出面板时 relatedTarget 为 null
    if (!e.relatedTarget) {
      dragDepth.current = 0
      setDragging(false)
      return
    }
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (e.dataTransfer.files.length > 0) {
      void uploadFiles(e.dataTransfer.files)
    }
  }

  const queueHint =
    queue && queue.total > 1 ? `正在解析并向量化 ${queue.done}/${queue.total}…` : '正在解析并向量化…'

  return (
    <div
      data-knowledge-panel
      className="relative flex h-full flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽悬停时的整面板提示层 */}
      {dragging && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/95">
          <span className="text-gray-900">
            <UploadIcon />
          </span>
          <p className="text-sm font-semibold text-gray-900">松开鼠标，上传到知识库</p>
          <p className="text-xs text-gray-500">支持 PDF / MD / TXT / DOCX，可一次拖入多个文件</p>
        </div>
      )}

      {/* 面板标题 */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">知识库</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          上传 PDF / Markdown / TXT / DOCX，聊天时自动检索增强回答
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* 上传区 */}
        <div
          role="button"
          tabIndex={0}
          aria-label="上传文档"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
            uploading
              ? 'border-gray-300 bg-gray-50'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
          )}
        >
          {uploading ? (
            <>
              <span className="size-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
              <p className="text-xs text-gray-500">{queueHint}</p>
            </>
          ) : (
            <>
              <span className="text-gray-400">
                <UploadIcon />
              </span>
              <p className="text-sm font-medium text-gray-700">点击选择或拖拽上传文档</p>
              <p className="text-xs text-gray-400">支持 PDF / MD / TXT / DOCX，单个 20MB 以内，可多选</p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void uploadFiles(e.target.files)
            }
            e.target.value = ''
          }}
        />

        {/* 错误提示 */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <div className="min-w-0 flex-1 whitespace-pre-line">{error}</div>
            <button
              type="button"
              onClick={clearError}
              aria-label="关闭错误提示"
              className="shrink-0 rounded p-0.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
            >
              <CloseIcon />
            </button>
          </div>
        )}

        {/* 文档列表 */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">已上传文档</p>
            {documents.length > 0 && (
              <span className="text-xs text-gray-400">{documents.length} 份</span>
            )}
          </div>

          {loading ? (
            <p className="py-6 text-center text-xs text-gray-400">加载中…</p>
          ) : documents.length === 0 ? (
            <p className="rounded-lg border border-gray-100 bg-white py-6 text-center text-xs text-gray-400">
              暂无文档，上传后即可在聊天中检索
            </p>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
