/**
 * 硅基流动（SiliconFlow）文本向量化客户端
 *
 * 配置（backend/.env）：
 * - EMBEDDING_MODEL_URL  可选，Embedding API 地址（默认 https://api.siliconflow.cn/v1/embeddings）
 * - EMBEDDING_MODEL_API  硅基流动 API Key（必填）
 * - EMBEDDING_MODEL      模型 ID（默认 BAAI/bge-m3，1024 维，中英文通用且速度快）
 * - EMBEDDING_DIM        期望向量维度（默认 1024，用于校验响应）
 *
 * API 与 OpenAI /embeddings 兼容，Node 18+ 内置 fetch 即可调用。
 */

const EMBEDDING_URL = process.env.EMBEDDING_MODEL_URL?.trim() || 'https://api.siliconflow.cn/v1/embeddings'

const DEFAULT_EMBEDDING_MODEL = 'BAAI/bge-m3'
const DEFAULT_EMBEDDING_DIM = 1024

/** 单次请求最多文本条数（硅基流动上限为 32，留出安全余量） */
const BATCH_SIZE = 16
/** 单次请求超时（毫秒） */
const EMBEDDING_TIMEOUT_MS = 30_000

/**
 * 单条文本安全长度上限（字符）。
 * bge-m3 最大输入 8192 token，中文约 1 字符 ≈ 0.6~1 token，
 * 取 6000 字符留出安全余量，超出则截断（避免分块异常导致 400）。
 */
const MAX_INPUT_CHARS = 6000

/** 将过长的文本截断到安全长度，并清理孤立代理字符（超限/异常时记录日志） */
function safeInput(text: string): string {
  let s = text
  if (s.length > MAX_INPUT_CHARS) {
    console.warn(`[embedding] 输入长度 ${s.length} 超过安全上限 ${MAX_INPUT_CHARS}，已截断`)
    s = s.slice(0, MAX_INPUT_CHARS)
  }
  // 兜底：分块/解析可能产生孤立代理（emoji 代理对被切开），硅基流动会以 400/20015 拒绝，
  // 这里把未配对的代理替换为 U+FFFD，避免请求失败
  const cleaned = s
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '\uFFFD')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
  if (cleaned !== s) {
    console.warn(`[embedding] 输入含孤立代理字符，已替换为 U+FFFD（原始长度 ${text.length}）`)
  }
  return cleaned
}

export class EmbeddingError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'EmbeddingError'
    this.status = status
  }
}

interface EmbeddingResponse {
  data?: { embedding?: number[] }[]
  error?: { message?: string }
}

function getConfig() {
  const apiKey = process.env.EMBEDDING_MODEL_API
  if (!apiKey) {
    throw new EmbeddingError('未配置 EMBEDDING_MODEL_API（请在 backend/.env 中设置硅基流动 Key）')
  }
  return {
    apiKey,
    model: process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    dim: Number(process.env.EMBEDDING_DIM || DEFAULT_EMBEDDING_DIM),
  }
}

/** 请求一次 embedding（单文本），返回向量；失败时抛出 EmbeddingError */
async function requestEmbedding(apiKey: string, model: string, text: string): Promise<number[]> {
  let response: Response
  try {
    response = await fetch(EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: safeInput(text),
        encoding_format: 'float',
      }),
      signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'TimeoutError'
    throw new EmbeddingError(
      aborted ? 'Embedding 请求超时，请稍后重试' : `无法连接硅基流动服务: ${(err as Error).message}`,
    )
  }

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      // 忽略响应体解析失败
    }
    // 记录失败上下文（模型、输入长度、响应体），便于定位 400/20015 等错误
    console.error(
      `[embedding] 向量化失败：模型=${model} 输入长度=${text.length} HTTP=${response.status} 响应=${detail.slice(0, 300)}`,
    )
    throw new EmbeddingError(`Embedding 请求失败（HTTP ${response.status}）: ${detail.slice(0, 500)}`, response.status)
  }

  let data: EmbeddingResponse
  try {
    data = (await response.json()) as EmbeddingResponse
  } catch {
    throw new EmbeddingError('Embedding 服务返回了无法解析的响应')
  }

  if (data.error?.message) {
    throw new EmbeddingError(`Embedding 服务返回错误: ${data.error.message}`)
  }

  const embedding = data.data?.[0]?.embedding
  if (!embedding || embedding.length === 0) {
    throw new EmbeddingError('Embedding 服务返回格式异常（缺少 data[0].embedding）')
  }
  return embedding
}

/**
 * 将单个文本向量化
 * @param text 待向量化文本（非空）
 * @returns 向量数组（float）
 */
export async function embedText(text: string): Promise<number[]> {
  const { apiKey, model, dim } = getConfig()
  const vector = await requestEmbedding(apiKey, model, text)
  if (vector.length !== dim) {
    console.warn(`[embedding] 模型 ${model} 返回维度 ${vector.length}，与配置 ${dim} 不一致`)
  }
  return vector
}

/**
 * 批量向量化文本
 * @param texts 待向量化文本数组
 * @param onBatch 可选：每批处理完成后的回调（用于进度上报）
 * @returns 与入参顺序一致的向量数组
 */
export async function embedTexts(
  texts: string[],
  onBatch?: (done: number, total: number) => void,
): Promise<number[][]> {
  const vectors: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const batchVectors = await Promise.all(batch.map((text) => embedText(text)))
    vectors.push(...batchVectors)
    onBatch?.(Math.min(i + BATCH_SIZE, texts.length), texts.length)
  }
  return vectors
}
