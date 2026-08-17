import { http } from './http'
import type { Conversation } from '../types/conversation'

/** 获取当前用户的会话列表（按最近更新倒序） */
export const fetchConversations = () => http.get<Conversation[]>('/conversations')

/** 新建会话 */
export const createConversation = (data?: { title?: string }) =>
  http.post<Conversation>('/conversations', data ?? {})

/** 删除会话 */
export const deleteConversation = (id: string) =>
  http.delete<void>(`/conversations/${id}`)
