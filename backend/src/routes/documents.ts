import { Router } from 'express'
import {
  deleteDocument,
  listDocuments,
  upload,
  uploadDocument,
} from '../controllers/documentController.js'

const router = Router()

// 知识库文档管理（需登录）
router.post('/', upload.single('file'), uploadDocument)
router.get('/', listDocuments)
router.delete('/:id', deleteDocument)

export default router
