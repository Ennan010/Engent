import { Router } from 'express'
import {
  createMessage,
  createMessageStream,
  listMessages,
} from '../controllers/messageController.js'

// mergeParams: 继承父路由 /conversations/:conversationId/messages 的 conversationId 路径参数
const router = Router({ mergeParams: true })

router.get('/', listMessages)
router.post('/', createMessage)
router.post('/stream', createMessageStream)

export default router
