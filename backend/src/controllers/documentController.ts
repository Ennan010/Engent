import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { ChunkVector, Document, DocumentChunk } from '../models/index.js'
import { sequelize } from '../../config/database.js'
import {
  detectDocType,
  DocumentParseError,
  MAX_DOC_SIZE,
  parseDocument,
} from '../services/documentParser.js'
import { chunkText } from '../services/chunker.js'
import { EmbeddingError, embedTexts } from '../services/embedding.js'
import { insertVectors } from '../services/vectorStore.js'

/** multipart 上传中间件：内存存储，限制 20MB */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_SIZE },
})

/**
 * 修复 multer/busboy 的中文文件名乱码。
 * busboy 对 multipart 的 filename 默认按 latin1 解码，中文文件名（UTF-8 字节）会变成
 * "ä¸ªäººç®å" 之类的乱码；此处把 latin1 字节按 UTF-8 重新解码还原。
 * 纯 ASCII 文件名（如 a.pdf）在两种编码下字节一致，转换后保持不变，可放心统一处理。
 */
function fixOriginalName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8')
}

function toDto(doc: Document) {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    size: doc.size,
    chunkCount: doc.chunkCount,
    status: doc.status,
    error: doc.error,
    createdAt: doc.createdAt,
  }
}

/** POST /api/documents —— 上传文档：解析 → 分块 → 向量化 → 入库 */
export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  let doc: Document | null = null
  try {
    const userId = req.userId as string
    if (!req.file) {
      return res.status(400).json({ error: '未接收到文件' })
    }
    const file = req.file
    const originalName = fixOriginalName(file.originalname)

    // 先落一条 processing 记录，失败时前端可看到具体错误
    doc = await Document.create({
      userId,
      name: originalName,
      type: detectDocType(originalName) ?? 'unknown',
      size: file.size,
      chunkCount: 0,
      status: 'processing',
    })

    try {
      const text = await parseDocument(originalName, file.buffer)
      const chunks = chunkText(text)
      if (chunks.length === 0) {
        throw new DocumentParseError('未能从文档中提取到有效内容')
      }

      // 向量化（可能多次请求，耗时较长）
      const embeddings = await embedTexts(chunks)

      // 入库：分块 + 向量（单事务，保证一致性）
      const createdChunks = await sequelize.transaction(async (t) => {
        const records = await Promise.all(
          chunks.map((content, i) =>
            DocumentChunk.create({ documentId: doc!.id, userId, seq: i + 1, content }, { transaction: t }),
          ),
        )
        await insertVectors(records.map((c) => c.id), userId, doc!.id, embeddings, { transaction: t })
        return records
      })

      await doc.update({ status: 'ready', chunkCount: createdChunks.length })
      return res.status(201).json({ document: toDto(doc) })
    } catch (err) {
      // 处理失败：保留记录并标记 failed，便于前端展示原因
      const message = err instanceof Error ? err.message : '未知错误'
      await doc.update({ status: 'failed', error: message }).catch(() => undefined)
      throw err
    }
  } catch (err) {
    if (err instanceof DocumentParseError) {
      return res.status(400).json({ error: err.message })
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件过大，仅支持 20MB 以内的文档' })
    }
    if (err instanceof EmbeddingError) {
      // 透传向量化服务的真实状态码（如 400 参数错误 / 429 限流），而非固定 502
      return res.status(err.status && err.status >= 400 && err.status < 600 ? err.status : 502).json({ error: err.message })
    }
    next(err)
  }
}

/** GET /api/documents —— 当前用户的知识库文档列表 */
export async function listDocuments(_req: Request, res: Response, next: NextFunction) {
  try {
    const userId = _req.userId as string
    const docs = await Document.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    })
    res.json({ documents: docs.map(toDto) })
  } catch (err) {
    next(err)
  }
}

/** DELETE /api/documents/:id —— 删除文档及其分块、向量 */
export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId as string
    const { id } = req.params as { id: string }
    const doc = await Document.findOne({ where: { id, userId } })
    if (!doc) {
      return res.status(404).json({ error: '文档不存在' })
    }

    await sequelize.transaction(async (t) => {
      await ChunkVector.destroy({ where: { userId, documentId: id }, transaction: t })
      await DocumentChunk.destroy({ where: { userId, documentId: id }, transaction: t })
      await doc.destroy({ transaction: t })
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
