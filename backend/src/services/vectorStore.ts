/**
 * 向量存储服务（路径 A：普通表 + BLOB + JS 余弦相似度）
 *
 * 个人知识库规模（数万块以内）下，全量加载用户向量在内存中做余弦检索
 * 毫秒级即可完成，无需引入 sqlite-vec 等原生扩展，跨平台零风险。
 * 若未来向量规模达到数十万级，可将本文件内部实现替换为 vec0 虚拟表，
 * 对外接口保持不变（insert / deleteByDocument / searchTopK）。
 */

import { Document, DocumentChunk } from '../models/index.js'
import { ChunkVector } from '../models/index.js'
import type { Transaction } from 'sequelize'

/** 余弦相似度阈值：低于该值的检索结果视为"不相关"，不注入上下文 */
export const RAG_MIN_SCORE = Number(process.env.RAG_MIN_SCORE || 0.35)
/** 每次检索返回的候选块数量 */
export const RAG_TOP_K = Number(process.env.RAG_TOP_K || 5)

/** 将 float 数组编码为 Float32Array 的二进制缓冲（供 BLOB 存储） */
export function encodeVector(values: number[]): Buffer {
  const arr = new Float32Array(values)
  return Buffer.from(arr.buffer)
}

/** 将 BLOB 缓冲解码为 Float32Array */
export function decodeVector(buf: Buffer): Float32Array {
  // BLOB 在部分驱动下返回 Buffer，兼容 Uint8Array/ArrayBuffer 形式
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBuffer)
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

/** 计算两个向量的余弦相似度（向量需等长；对零向量返回 0） */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export interface StoredVector {
  chunkId: string
  userId: string
  documentId: string
  embedding: Buffer
}

/** 保存一个分块的向量（已存在则覆盖） */
export async function insertVector(chunkId: string, userId: string, documentId: string, embedding: number[]): Promise<void> {
  await ChunkVector.upsert({
    id: chunkId,
    userId,
    documentId,
    embedding: encodeVector(embedding),
  })
}

/**
 * 批量保存向量（顺序与 chunks 一致）
 *
 * 使用 bulkCreate 单条 SQL 批量插入，替代逐条 upsert：
 * - 一次写库代替 N 次写库，大幅缩短写锁持有时间（对 SQLite 尤其重要）
 * - 同一 id 已存在时幂等覆盖（重传/并发安全），行为与原 upsert 一致
 * @param options.transaction 传入后与分块写入同处一个事务，保证原子性
 */
export async function insertVectors(
  chunkIds: string[],
  userId: string,
  documentId: string,
  embeddings: number[][],
  options?: { transaction?: Transaction },
): Promise<void> {
  if (chunkIds.length === 0) return
  await ChunkVector.bulkCreate(
    chunkIds.map((id, i) => ({
      id,
      userId,
      documentId,
      embedding: encodeVector(embeddings[i]),
    })),
    {
      transaction: options?.transaction,
      updateOnDuplicate: ['embedding', 'updatedAt'],
    },
  )
}

/** 删除某文档的全部向量 */
export async function deleteVectorsByDocument(userId: string, documentId: string): Promise<void> {
  await ChunkVector.destroy({ where: { userId, documentId } })
}

export interface ChunkHit {
  chunkId: string
  content: string
  seq: number
  documentName: string
  score: number
}

/**
 * 检索与查询向量最相似的前 topK 个分块（带分块内容与所属文档名）
 * @param minScore 相似度阈值：低于该值的命中会被过滤（默认 0，由调用方按场景决定）
 * @returns 按相似度降序的命中列表
 */
export async function searchTopK(
  userId: string,
  query: number[],
  topK: number = RAG_TOP_K,
  minScore: number = 0,
): Promise<ChunkHit[]> {
  const vectors = await ChunkVector.findAll({ where: { userId }, attributes: ['id', 'documentId', 'embedding'] })
  if (vectors.length === 0) return []

  const queryVec = new Float32Array(query)
  const scored = vectors
    .map((v) => ({
      chunkId: v.id,
      documentId: v.documentId,
      score: cosineSimilarity(queryVec, decodeVector(v.embedding)),
    }))
    .sort((a, b) => b.score - a.score)

  const hits = scored.slice(0, topK).filter((s) => s.score >= minScore)
  if (hits.length === 0) return []

  const chunks = await DocumentChunk.findAll({
    where: { id: hits.map((h) => h.chunkId) },
    attributes: ['id', 'documentId', 'seq', 'content'],
  })
  const chunkById = new Map(chunks.map((c) => [c.id, c]))

  // 文档名用于上下文标注来源；批量取一次
  const docIds = [...new Set(hits.map((h) => h.documentId))]
  const docs = await Document.findAll({ where: { id: docIds }, attributes: ['id', 'name'] })
  const docNameById = new Map(docs.map((d) => [d.id, d.name]))

  return hits
    .map((h) => {
      const chunk = chunkById.get(h.chunkId)
      if (!chunk) return null
      return {
        chunkId: h.chunkId,
        content: chunk.content,
        seq: chunk.seq,
        documentName: docNameById.get(h.documentId) ?? '未知文档',
        score: h.score,
      }
    })
    .filter((x): x is ChunkHit => x !== null)
}
