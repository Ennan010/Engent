import { createContext } from 'react'
import type { KnowledgeDocument } from '../types/document'

/** 批量上传进度：已上传 done/total 个文件 */
export interface UploadQueue {
  total: number
  done: number
}

export interface KnowledgeContextValue {
  /** 当前用户的知识库文档列表（按创建时间倒序） */
  documents: KnowledgeDocument[]
  /** 首次加载中 */
  loading: boolean
  /** 是否有文件正在上传/向量化 */
  uploading: boolean
  /** 批量上传进度 */
  queue: UploadQueue | null
  /** 最近一次错误提示（上传/删除失败等） */
  error: string | null
  /** 上传文件（支持多选/拖拽，自动过滤不支持的类型与超限文件，顺序逐个上传） */
  uploadFiles: (files: FileList | File[]) => Promise<void>
  /** 删除文档（成功后同步移除列表项） */
  removeDocument: (id: string) => Promise<void>
  /** 清空错误提示 */
  clearError: () => void
}

export const KnowledgeContext = createContext<KnowledgeContextValue | null>(null)
