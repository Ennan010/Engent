import { useCallback, useEffect, useState } from 'react'
import type { KnowledgeDocument } from '../types/document'
import * as documentApi from '../api/documents'
import type { UploadQueue } from '../context/knowledgeContext'

const MAX_SIZE = 20 * 1024 * 1024
const ACCEPT_RE = /\.(pdf|md|markdown|txt|text|docx)$/i

function isAccepted(fileName: string): boolean {
  return ACCEPT_RE.test(fileName)
}

/** 从请求错误中提取后端返回的业务错误信息（如 "未授权或 token 已失效"），避免只显示 axios 的笼统文案 */
function toErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { error?: unknown } } }).response?.data
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error
    }
  }
  return err instanceof Error ? err.message : fallback
}

/** 知识库核心状态：文档列表 / 多文件顺序上传（含校验与进度）/ 删除 */
export function useKnowledge() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [queue, setQueue] = useState<UploadQueue | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 首次加载知识库文档列表
  useEffect(() => {
    let cancelled = false
    documentApi
      .fetchDocuments()
      .then(({ documents: docs }) => {
        if (cancelled) return
        setDocuments(docs)
      })
      .catch((err) => console.error('加载知识库失败:', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return

    // 客户端预校验：过滤不支持的类型与超限文件，其余逐个上传
    const rejected: string[] = []
    const valid = list.filter((file) => {
      if (!isAccepted(file.name)) {
        rejected.push(`${file.name}（格式不支持）`)
        return false
      }
      if (file.size > MAX_SIZE) {
        rejected.push(`${file.name}（超过 20MB）`)
        return false
      }
      return true
    })

    if (valid.length === 0) {
      setError(rejected.length > 0 ? `以下文件未能上传：${rejected.join('、')}` : '未选择有效文件')
      return
    }

    setUploading(true)
    setQueue({ total: valid.length, done: 0 })
    setError(null)

    let done = 0
    for (const file of valid) {
      try {
        const { document } = await documentApi.uploadDocument(file)
        // 后端返回可能按时间倒序，直接插到队首（同文件重复上传时去重）
        setDocuments((prev) => [document, ...prev.filter((d) => d.id !== document.id)])
      } catch (err) {
        const msg = toErrorMessage(err, `${file.name} 上传失败`)
        setError((prev) => (prev ? `${prev}\n${msg}` : msg))
      } finally {
        done += 1
        setQueue({ total: valid.length, done })
      }
    }

    setQueue(null)
    setUploading(false)
  }, [])

  const removeDocument = useCallback(async (id: string) => {
    try {
      await documentApi.deleteDocument(id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      console.error('删除文档失败:', err)
      setError(toErrorMessage(err, '删除失败，请重试'))
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { documents, loading, uploading, queue, error, uploadFiles, removeDocument, clearError }
}
