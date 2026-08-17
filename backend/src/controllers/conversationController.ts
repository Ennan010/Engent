import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { Conversation, Message } from '../models/index.js'

const createConversationSchema = z.object({
  title: z.string().min(1).max(256).optional(),
})

/** GET /api/conversations —— 当前用户的会话列表（按最近更新倒序） */
export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId as string
    const conversations = await Conversation.findAll({
      where: { userId },
      order: [['updatedAt', 'DESC']],
    })
    res.json(conversations)
  } catch (err) {
    next(err)
  }
}

/** POST /api/conversations —— 新建会话 */
export async function createConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createConversationSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: '参数错误', details: parsed.error.issues })
    }
    const userId = req.userId as string
    const conversation = await Conversation.create({
      userId,
      title: parsed.data.title ?? '新对话',
    })
    res.status(201).json(conversation)
  } catch (err) {
    next(err)
  }
}

/** DELETE /api/conversations/:id —— 删除会话及其全部消息 */
export async function deleteConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId as string
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, userId },
    })
    if (!conversation) {
      return res.status(404).json({ error: '会话不存在' })
    }
    await Message.destroy({ where: { conversationId: conversation.id } })
    await conversation.destroy()
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
