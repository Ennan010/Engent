import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { Conversation, Message } from '../models/index.js'
import {
  chatCompletion,
  DEFAULT_SYSTEM_PROMPT,
  LlmError,
  streamChatCompletion,
  type LlmMessage,
} from '../services/llm.js'
import { buildRagContext } from '../services/rag.js'

const sendMessageSchema = z.object({
  content: z.string().min(1).max(8000),
})

/** 对话上下文保留的最大消息条数（含刚保存的用户消息） */
const HISTORY_LIMIT = 20

/** 加载会话最近消息作为模型上下文 */
async function loadHistory(conversationId: string): Promise<LlmMessage[]> {
  const history = await Message.findAll({
    where: { conversationId },
    order: [['createdAt', 'ASC']],
    limit: HISTORY_LIMIT,
  })
  return history.map((m) => ({ role: m.role, content: m.content }))
}

/**
 * 组装发送给 LLM 的完整消息：
 * 系统提示（含 RAG 检索到的知识库上下文，若该问题判定需要检索）+ 会话历史
 */
async function buildLlmMessages(
  userId: string,
  conversationId: string,
  userContent: string,
): Promise<LlmMessage[]> {
  const history = await loadHistory(conversationId)
  const ragContext = await buildRagContext(userId, userContent)
  const systemContent = ragContext
    ? `${DEFAULT_SYSTEM_PROMPT}\n\n${ragContext}`
    : DEFAULT_SYSTEM_PROMPT
  return [
    { role: 'system', content: systemContent },
    ...history,
  ]
}

/** GET /api/conversations/:conversationId/messages —— 会话消息列表（按时间正序） */
export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId as string
    const { conversationId } = req.params as { conversationId: string }
    const conversation = await Conversation.findOne({ where: { id: conversationId, userId } })
    if (!conversation) {
      return res.status(404).json({ error: '会话不存在' })
    }
    const messages = await Message.findAll({
      where: { conversationId },
      order: [['createdAt', 'ASC']],
    })
    res.json(messages)
  } catch (err) {
    next(err)
  }
}

/** POST /api/conversations/:conversationId/messages —— 发送消息（非流式：等待完整回复后一次性返回） */
export async function createMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = sendMessageSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: '参数错误', details: parsed.error.issues })
    }

    const userId = req.userId as string
    const { conversationId } = req.params as { conversationId: string }
    const conversation = await Conversation.findOne({ where: { id: conversationId, userId } })
    if (!conversation) {
      return res.status(404).json({ error: '会话不存在' })
    }

    const userMessage = await Message.create({
      conversationId,
      role: 'user',
      content: parsed.data.content,
    })

    // 组装上下文：系统提示（含 RAG 上下文）+ 会话最近消息
    const llmMessages = await buildLlmMessages(userId, conversationId, parsed.data.content)

    // 调用 GLM 模型生成回复；失败时保存错误提示消息，保证前后端数据一致
    let assistantContent: string
    try {
      assistantContent = await chatCompletion(llmMessages)
    } catch (err) {
      const detail = err instanceof LlmError ? err.message : (err as Error).message
      console.error('[llm] 调用失败:', detail)
      assistantContent = '抱歉，AI 服务暂时不可用，请稍后重试。'
    }

    const assistantMessage = await Message.create({
      conversationId,
      role: 'assistant',
      content: assistantContent,
    })

    // 首条消息时以消息内容作为会话标题
    if (conversation.title === '新对话') {
      await conversation.update({ title: parsed.data.content.slice(0, 30) })
    }

    res.status(201).json({ userMessage, assistantMessage })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/conversations/:conversationId/messages/stream
 * 发送消息（SSE 流式）：保存用户消息后，将 AI 回复以 text/event-stream 逐块推送给前端。
 * 事件格式（data: {JSON}\n\n）：
 *   { delta: string }                            生成中的一段增量文本
 *   { done: true, userMessage, assistantMessage } 生成完成，携带后端持久化的消息
 *   { error: string }                             LLM 或保存失败时的错误信息
 */
export async function createMessageStream(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = sendMessageSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: '参数错误', details: parsed.error.issues })
    }

    const userId = req.userId as string
    const { conversationId } = req.params as { conversationId: string }
    const conversation = await Conversation.findOne({ where: { id: conversationId, userId } })
    if (!conversation) {
      return res.status(404).json({ error: '会话不存在' })
    }

    const userMessage = await Message.create({
      conversationId,
      role: 'user',
      content: parsed.data.content,
    })

    // 组装上下文：系统提示（含 RAG 上下文）+ 会话最近消息
    const llmMessages = await buildLlmMessages(userId, conversationId, parsed.data.content)

    // 建立 SSE 响应（此后错误只能通过事件发送，不能再返回 JSON 状态码）
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const sendEvent = (data: unknown) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }
    }

    // 流式生成 AI 回复，逐块推送给前端
    let assistantContent = ''
    try {
      const stream = await streamChatCompletion(llmMessages)
      for await (const delta of stream) {
        assistantContent += delta
        sendEvent({ delta })
      }
    } catch (err) {
      const detail = err instanceof LlmError ? err.message : (err as Error).message
      console.error('[llm] 流式调用失败:', detail)
      assistantContent = '抱歉，AI 服务暂时不可用，请稍后重试。'
    }

    // 持久化 AI 回复；保存失败不中断连接，改用错误事件告知前端
    let assistantMessage: Message | null = null
    try {
      assistantMessage = await Message.create({
        conversationId,
        role: 'assistant',
        content: assistantContent,
      })
    } catch (err) {
      console.error('[messages] 保存 AI 回复失败:', err)
    }

    // 首条消息时以消息内容作为会话标题
    if (conversation.title === '新对话') {
      await conversation.update({ title: parsed.data.content.slice(0, 30) }).catch(() => undefined)
    }

    if (assistantMessage) {
      sendEvent({ done: true, userMessage, assistantMessage })
    } else {
      sendEvent({ error: 'AI 回复保存失败' })
    }
    res.end()
  } catch (err) {
    next(err)
  }
}
