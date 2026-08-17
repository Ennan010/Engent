/**
 * RAG（检索增强生成）服务
 *
 * 不是所有问题都要走知识库检索，这里实现三层判定，尽量只对
 * "需要外部知识" 的问题触发检索：
 *
 * 1. force  —— 显式指令：问题中包含"根据文档/知识库/资料里…"等强意图词，
 *              说明用户明确要求基于资料回答 → 强制检索（放宽相似度阈值）
 * 2. skip   —— 闲聊/寒暄：问候、致谢、身份询问等纯对话性问题，
 *              与知识库无关 → 跳过检索，直接交给 GLM 原生能力
 * 3. auto   —— 其余问题：默认尝试检索，但用相似度门控兜底，
 *              若最相似分块仍低于阈值则视为不相关，不注入上下文
 */

import { embedText } from './embedding.js'
import { ChunkVector } from '../models/index.js'
import { RAG_MIN_SCORE, searchTopK, type ChunkHit } from './vectorStore.js'

/** 显式要求使用知识库的意图词（命中即强制 RAG） */
const EXPLICIT_RAG_KEYWORDS = [
  '根据文档',
  '基于文档',
  '根据资料',
  '基于资料',
  '根据知识库',
  '基于知识库',
  '知识库里',
  '知识库中',
  '上传的文档',
  '上传的资料',
  '文档里',
  '文档中',
  '文档说',
  '资料里',
  '资料中',
  '资料说',
  '帮我查',
  '查一下',
  '查找一下',
  '搜索一下',
  '总结一下',
  '归纳一下',
]

/** 明显与知识库无关的闲聊/寒暄词（命中即跳过 RAG） */
const SKIP_RAG_KEYWORDS = [
  '你好',
  '您好',
  '哈喽',
  '嗨',
  '早上好',
  '中午好',
  '下午好',
  '晚上好',
  '谢谢',
  '感谢',
  '多谢',
  '再见',
  '拜拜',
  '晚安',
  '你是谁',
  '你叫什么',
  '你是哪个',
  '你能做什么',
  '你可以做什么',
  '你擅长',
  '介绍一下你自己',
  '你是谁开发的',
  '谁开发的你',
  '在吗',
  '在不在',
  'hello',
  'hi',
  'hey',
  'thanks',
  'thank you',
]

export type RagDecision = 'force' | 'skip' | 'auto'

/** 判断某条用户消息是否应触发知识库检索 */
export function decideRag(content: string): RagDecision {
  const text = content.trim().toLowerCase()
  if (!text) return 'skip'
  if (EXPLICIT_RAG_KEYWORDS.some((kw) => text.includes(kw))) return 'force'
  if (SKIP_RAG_KEYWORDS.some((kw) => text.includes(kw))) return 'skip'
  return 'auto'
}

/** 将检索命中组装为注入系统提示的知识库上下文文本 */
function formatContext(hits: ChunkHit[]): string {
  // 按文档分组，保持检索顺序
  const byDoc = new Map<string, { name: string; lines: string[] }>()
  for (const hit of hits) {
    const group = byDoc.get(hit.documentName) ?? { name: hit.documentName, lines: [] }
    group.lines.push(hit.content.trim())
    byDoc.set(hit.documentName, group)
  }

  const sections: string[] = []
  for (const group of byDoc.values()) {
    sections.push(`来自《${group.name}》：\n${group.lines.map((l) => `- ${l}`).join('\n')}`)
  }

  return `[知识库资料]\n${sections.join('\n\n')}\n[资料结束]\n请优先基于以上资料回答用户问题；资料不足以回答时，明确告知用户并在该方面给出你的通用建议。`
}

/**
 * 为一条用户消息构建 RAG 上下文：
 * - 无知识库文档或判定为闲聊时返回 null
 * - 检索结果全部低于相似度阈值时返回 null（避免无关资料污染回答）
 *
 * @param userId 当前用户
 * @param question 用户消息内容
 * @returns 可注入系统提示的上下文文本；不需要时返回 null
 */
export async function buildRagContext(userId: string, question: string): Promise<string | null> {
  const decision = decideRag(question)
  if (decision === 'skip') return null

  // 知识库为空时不发起向量化请求（避免浪费 API 调用）
  const vectorCount = await ChunkVector.count({ where: { userId } })
  if (vectorCount === 0) return null

  let queryEmbedding: number[]
  try {
    queryEmbedding = await embedText(question)
  } catch (err) {
    // 向量化失败不应阻断聊天：降级为不检索
    console.warn('[rag] 问题向量化失败，跳过检索:', (err as Error).message)
    return null
  }

  // force 模式：用户明确要求基于资料，检索即注入（不设相似度门槛）
  if (decision === 'force') {
    const hits = await searchTopK(userId, queryEmbedding, 5)
    return hits.length > 0 ? formatContext(hits) : null
  }

  // auto 模式：相似度门控兜底，无强相关分块时视为与知识库无关
  const hits = await searchTopK(userId, queryEmbedding, 5, RAG_MIN_SCORE)
  return hits.length > 0 ? formatContext(hits) : null
}
