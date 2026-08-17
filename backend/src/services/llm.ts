/**
 * 智谱 GLM（open.bigmodel.cn）对话补全客户端
 *
 * 配置（backend/.env）：
 * - GLM_CHAT_URL         可选，智谱兼容 API 地址（默认 https://open.bigmodel.cn/api/paas/v4/chat/completions）
 * - GLM_47_Flash_API_KEY  文本对话模型 API Key（必填）
 * - GLM_TEXT_MODELS       可选，逗号分隔的候选模型 ID（默认免费文本模型）
 *                         调用时自动测速排序：最近响应最快的优先；
 *                         瞬时失败（429/5xx/超时）的模型进入冷却并自动切换下一个
 *
 * 说明：Node 18+ 内置全局 fetch，无需额外 HTTP 依赖。
 */

const GLM_CHAT_URL =
  process.env.GLM_CHAT_URL?.trim() || 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

/** 默认候选模型：智谱免费文本模型（冷启动初始顺序） */
const DEFAULT_TEXT_MODELS = ['glm-4.5-flash', 'glm-4.7-flash', 'glm-4-flash-250414', 'glm-4-flash']

/** 智谱 API 请求超时（首响应超时即中止并以 LlmError 抛出，触发模型切换） */
const LLM_REQUEST_TIMEOUT_MS = 30_000

/** 模型失败冷却：429 限流 60s，5xx 服务端错误 120s，超时 300s */
const COOLDOWN_RATE_LIMIT_MS = 60_000
const COOLDOWN_SERVER_ERROR_MS = 120_000
const COOLDOWN_TIMEOUT_MS = 300_000

interface ModelHealth {
  /** 最近一次成功调用的响应耗时（毫秒），未成功测速过则无此字段 */
  latencyMs?: number
  /** 冷却截止时间戳，0 表示不在冷却期 */
  cooldownUntil: number
}

/** 各模型的健康状态（进程内存态，用于动态测速排序与失败冷却） */
const modelHealth = new Map<string, ModelHealth>()

export type LlmRole = 'system' | 'user' | 'assistant'

export interface LlmMessage {
  role: LlmRole
  content: string
}

/** AI 服务调用错误（携带可读信息，便于日志与错误提示） */
export class LlmError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'LlmError'
    this.status = status
  }
}

/** 默认系统提示词：使用用户语言、简洁友好的助手 */
export const DEFAULT_SYSTEM_PROMPT =
  '你是一个乐于助人的 AI 助手。请用与用户相同的语言，给出简洁、准确、友好的回答。'

interface ChatCompletionResponse {
  choices?: { message?: { role?: string; content?: string } }[]
  error?: { message?: string }
}

/**
 * 计算本次调用的候选模型顺序（过滤冷却中的模型后排序）：
 * 1. 从未调用过的模型最先（给新模型测速机会，尽快发现更快的）
 * 2. 成功测速过的按最近响应耗时升序（最快的排前面）
 * 3. 调用过但失败的排最后（避免反复试慢/坏模型，恢复后会自动回归正常排序）
 */
function getTextModelCandidates(): string[] {
  const fromEnv = (process.env.GLM_TEXT_MODELS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const base = fromEnv.length > 0 ? fromEnv : DEFAULT_TEXT_MODELS
  const now = Date.now()
  const healthy = base.filter((model) => (modelHealth.get(model)?.cooldownUntil ?? 0) <= now)

  const rank = (model: string): [number, number] => {
    const health = modelHealth.get(model)
    if (!health) return [0, 0] // 从未调用：优先测速
    if (health.latencyMs === undefined) return [2, 0] // 调用过但失败：排最后
    return [1, health.latencyMs] // 成功测速：按耗时
  }
  return healthy.sort((a, b) => {
    const [rankA, speedA] = rank(a)
    const [rankB, speedB] = rank(b)
    if (rankA !== rankB) return rankA - rankB
    return speedA - speedB
  })
}

/** 记录一次成功调用（耗时即测速基准），并解除冷却 */
function markModelSuccess(model: string, latencyMs: number) {
  modelHealth.set(model, { latencyMs, cooldownUntil: 0 })
}

/** 标记模型失败冷却：429 限流 60s，5xx 服务端错误 120s，超时 300s */
function coolModel(model: string, status: number) {
  const cooldown =
    status === 429
      ? COOLDOWN_RATE_LIMIT_MS
      : status === 408
        ? COOLDOWN_TIMEOUT_MS
        : COOLDOWN_SERVER_ERROR_MS
  modelHealth.set(model, {
    ...modelHealth.get(model),
    cooldownUntil: Date.now() + cooldown,
  })
  console.warn(`[llm] 模型 ${model} 不可用（HTTP ${status || '未知'}），冷却 ${cooldown / 1000}s`)
}

/**
 * 按候选模型顺序执行一次调用：
 * 瞬时失败（429/5xx/超时）的模型进入冷却并自动切换下一个，
 * 成功后记录响应耗时作为测速基准，下次优先调用最快的模型。
 */
async function withModelFallback<T>(
  call: (model: string) => Promise<T>,
  onSuccess: (model: string, latencyMs: number) => void,
): Promise<T> {
  const models = getTextModelCandidates()
  if (models.length === 0) {
    throw new LlmError('所有可用的 GLM 模型均处于冷却中，请稍后重试')
  }

  let lastError: LlmError | null = null
  for (const model of models) {
    const started = Date.now()
    try {
      const result = await call(model)
      onSuccess(model, Date.now() - started)
      return result
    } catch (err) {
      lastError = err instanceof LlmError ? err : new LlmError((err as Error).message)
      const status = lastError.status ?? 0
      const isTimeout = err instanceof Error && err.name === 'TimeoutError'
      const isTransient = isTimeout || status === 408 || status === 429 || (status >= 500 && status < 600)
      if (isTransient) {
        coolModel(model, status)
        continue
      }
      throw lastError
    }
  }
  throw lastError ?? new LlmError('所有可用的 GLM 模型均调用失败')
}

/** 请求单个模型的对话补全，失败时抛出带 HTTP 状态码的 LlmError */
async function requestCompletion(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  temperature: number,
): Promise<string> {
  let response: Response
  try {
    response = await fetch(GLM_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature,
      }),
      signal: AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'TimeoutError'
    throw new LlmError(
      aborted ? '智谱 AI 请求超时，请稍后重试' : `无法连接智谱 AI 服务: ${(err as Error).message}`,
      // 超时以 408 标记，供模型切换逻辑识别为瞬时错误
      aborted ? 408 : undefined,
    )
  }

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      // 忽略响应体解析失败
    }
    throw new LlmError(
      `智谱 AI 请求失败（HTTP ${response.status}）: ${detail.slice(0, 500)}`,
      response.status,
    )
  }

  let data: ChatCompletionResponse
  try {
    data = (await response.json()) as ChatCompletionResponse
  } catch {
    throw new LlmError('智谱 AI 返回了无法解析的响应')
  }

  if (data.error?.message) {
    throw new LlmError(`智谱 AI 返回错误: ${data.error.message}`)
  }

  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new LlmError('智谱 AI 返回格式异常（缺少 choices[0].message.content）')
  }
  return content
}

/**
 * 调用 GLM 文本模型完成一次对话补全
 * 主模型因访问量过大（HTTP 429）或服务端异常（HTTP 5xx）失败时，自动回退到备用模型。
 * @param messages 完整对话上下文（可含 system / user / assistant 角色）
 * @param options.temperature 采样温度（默认 0.7）
 * @returns 模型回复文本
 */
export async function chatCompletion(
  messages: LlmMessage[],
  options: { temperature?: number } = {},
): Promise<string> {
  const apiKey = process.env.GLM_47_Flash_API_KEY
  if (!apiKey) {
    throw new LlmError('未配置 GLM_47_Flash_API_KEY（请在 backend/.env 中设置）')
  }

  const temperature = options.temperature ?? 0.7
  return withModelFallback(
    (model) => requestCompletion(apiKey, model, messages, temperature),
    markModelSuccess,
  )
}

interface StreamChunkResponse {
  choices?: { delta?: { content?: string } }[]
  error?: { message?: string }
}

/**
 * 请求单个模型的流式对话补全（SSE），返回逐块产出文本增量的 ReadableStream。
 * 解析 OpenAI 兼容的 SSE 格式：data: {JSON}\n\n，以 data: [DONE] 结束。
 */
async function requestStreamCompletion(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  temperature: number,
): Promise<ReadableStream<string>> {
  let response: Response
  try {
    response = await fetch(GLM_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature,
      }),
      signal: AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'TimeoutError'
    throw new LlmError(
      aborted ? '智谱 AI 请求超时，请稍后重试' : `无法连接智谱 AI 服务: ${(err as Error).message}`,
      // 超时以 408 标记，供模型切换逻辑识别为瞬时错误
      aborted ? 408 : undefined,
    )
  }

  if (!response.ok || !response.body) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      // 忽略响应体解析失败
    }
    throw new LlmError(
      `智谱 AI 请求失败（HTTP ${response.status}）: ${detail.slice(0, 500)}`,
      response.status,
    )
  }

  return new ReadableStream<string>({
    async start(controller) {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          // SSE 事件以空行分隔，逐行解析
          const parts = buffer.split('\n')
          buffer = parts.pop() ?? ''
          for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '[DONE]') {
              controller.close()
              return
            }
            try {
              const json = JSON.parse(data) as StreamChunkResponse
              if (json.error?.message) {
                controller.error(new LlmError(`智谱 AI 流式返回错误: ${json.error.message}`))
                return
              }
              const delta = json.choices?.[0]?.delta?.content
              if (typeof delta === 'string' && delta) {
                controller.enqueue(delta)
              }
            } catch {
              // 忽略无法解析的数据行
            }
          }
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}

/**
 * 流式调用 GLM 文本模型完成一次对话补全（SSE 逐块返回增量文本）。
 * 与 chatCompletion 相同的模型回退策略：主模型 429/5xx 时回退到备用模型。
 * @param messages 完整对话上下文（可含 system / user / assistant 角色）
 * @param options.temperature 采样温度（默认 0.7）
 */
export async function streamChatCompletion(
  messages: LlmMessage[],
  options: { temperature?: number } = {},
): Promise<ReadableStream<string>> {
  const apiKey = process.env.GLM_47_Flash_API_KEY
  if (!apiKey) {
    throw new LlmError('未配置 GLM_47_Flash_API_KEY（请在 backend/.env 中设置）')
  }

  const temperature = options.temperature ?? 0.7
  return withModelFallback(
    (model) => requestStreamCompletion(apiKey, model, messages, temperature),
    markModelSuccess,
  )
}
