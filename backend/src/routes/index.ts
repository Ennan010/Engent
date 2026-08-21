import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import authRouter from './auth.js'
import conversationsRouter from './conversations.js'
import messagesRouter from './messages.js'
import documentsRouter from './documents.js'

const router = Router()

// 认证相关（登录回调换 token / 用户信息），无需登录即可访问
router.use('/auth', authRouter)

// 会话与消息接口均需登录（Authing JWT 验证）
router.use('/conversations', requireAuth, conversationsRouter)
router.use('/conversations/:conversationId/messages', requireAuth, messagesRouter)
router.use('/documents', requireAuth, documentsRouter)

export default router
