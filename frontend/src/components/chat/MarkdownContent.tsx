import { Children, isValidElement, memo, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

interface MarkdownContentProps {
  content: string
}

/** 复制文本到剪贴板（不可用时静默失败） */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // 忽略剪贴板权限/不可用场景
  }
}

/** 递归提取代码块纯文本（<pre><code> → string），供复制按钮使用 */
function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return extractText(node.props.children)
  return ''
}

/** 从 rehype-highlight 生成的 className（如 "hljs language-ts"）提取语言名 */
function extractLanguage(className?: string): string | undefined {
  return /language-([\w+-]+)/.exec(className ?? '')?.[1]
}

/**
 * Markdown 渲染组件（基于 react-markdown）
 *
 * - 支持 GFM：表格、删除线、任务列表
 * - remark-breaks：聊天回复里的单换行直接换行（保持原有 whitespace-pre-wrap 体验）
 * - 代码块：深色底 + 语言标签 + 复制按钮；行内代码浅色高亮
 * - 链接默认新窗口打开
 */
function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-body min-w-0 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre({ children }) {
            const codeChild = Children.only(children) as ReactElement<{
              className?: string
              children?: ReactNode
            }>
            const lang = extractLanguage(codeChild?.props?.className)
            const text = extractText(children)
            return (
              <div className="group relative my-3 overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-800 bg-gray-800/70 px-3 py-1.5">
                  <span className="font-mono text-xs text-gray-400">{lang ?? 'code'}</span>
                  <button
                    type="button"
                    onClick={() => copyText(text)}
                    className="rounded-md px-2 py-0.5 font-mono text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
                  >
                    复制
                  </button>
                </div>
                <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed text-gray-100">
                  {children}
                </pre>
              </div>
            )
          },
          code({ className, children }) {
            const isBlock = Boolean(extractLanguage(className))
            if (isBlock) {
              return (
                <code className={`${className ?? ''} font-mono text-[13px]`}>{children}</code>
              )
            }
            return (
              <code className="rounded-md bg-gray-200/90 px-1.5 py-0.5 font-mono text-[0.85em] text-gray-800">
                {children}
              </code>
            )
          },
          a({ node: _node, children, ...props }) {
            return (
              <a {...props} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-gray-300">
                <table className="w-full border-collapse text-left text-[13px]">{children}</table>
              </div>
            )
          },
          thead({ children }) {
            return <thead className="bg-gray-200/70 text-gray-700">{children}</thead>
          },
          th({ children }) {
            return <th className="px-3 py-1.5 font-semibold">{children}</th>
          },
          td({ children }) {
            return <td className="border-t border-gray-300 px-3 py-1.5 align-top">{children}</td>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default memo(MarkdownContent)
