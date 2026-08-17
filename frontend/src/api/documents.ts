import { http } from './http'
import type { KnowledgeDocument } from '../types/document'

/** 上传文档并入库（解析 → 分块 → 向量化） */
export async function uploadDocument(file: File): Promise<{ document: KnowledgeDocument }> {
  const formData = new FormData()
  formData.append('file', file)
  return http.post<{ document: KnowledgeDocument }>('/documents', formData, {
    // 注意：不要手动设置 Content-Type，交给浏览器自动生成带 boundary 的 multipart 头，
    // 否则后端 multer 无法解析 multipart 边界会直接失败
    timeout: 120000, // 向量化耗时较长，放宽超时
  })
}

/** 获取当前用户的知识库文档列表 */
export async function fetchDocuments(): Promise<{ documents: KnowledgeDocument[] }> {
  return http.get<{ documents: KnowledgeDocument[] }>('/documents')
}

/** 删除文档（含分块与向量） */
export async function deleteDocument(id: string): Promise<{ ok: boolean }> {
  return http.delete<{ ok: boolean }>(`/documents/${id}`)
}
