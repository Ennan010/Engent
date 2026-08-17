export interface Conversation {
  id: string
  title: string
  /** 后端返回的扩展字段（可选，UI 暂未使用） */
  userId?: string
  createdAt?: string
  updatedAt?: string
}
