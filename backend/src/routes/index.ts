import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import conversationsRouter from './conversations.js'
import messagesRouter from './messages.js'
import documentsRouter from './documents.js'

const router = Router()

// 会话与消息接口均需登录（Authing JWT 验证）
router.use('/conversations', requireAuth, conversationsRouter)
router.use('/conversations/:conversationId/messages', requireAuth, messagesRouter)
router.use('/documents', requireAuth, documentsRouter)

export default router
