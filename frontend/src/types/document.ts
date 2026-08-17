export type DocumentStatus = 'processing' | 'ready' | 'failed'

export interface KnowledgeDocument {
  id: string
  name: string
  type: string
  size: number
  chunkCount: number
  status: DocumentStatus
  error?: string | null
  createdAt: string
}
