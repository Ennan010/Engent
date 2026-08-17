import { Router } from 'express'
import {
  createConversation,
  deleteConversation,
  listConversations,
} from '../controllers/conversationController.js'

const router = Router()

router.get('/', listConversations)
router.post('/', createConversation)
router.delete('/:id', deleteConversation)

export default router
