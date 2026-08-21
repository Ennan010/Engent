/**
 * 联网搜索服务（Bing 免费搜索页解析）
 *
 * 用于回答时效性/实时性问题（新闻、天气、行情等）。
 * 方案说明：Bing 搜索页（cn.bing.com）在国内可直连、无需 API Key、无额度限制，
 * 通过解析其免费搜索结果页（li.b_algo 结构）提取 标题/链接/摘要，真正"永久免费"。
 * 相比商业搜索 API 的缺点：无结构化 JSON、受反爬限制，因此做了超时与降级保护。
 *
 * 判定逻辑与 RAG 保持一致风格：
 * - 命中显式意图词（"联网/网上/实时"等）→ 强制搜索
 * - 命中时效性关键词（最新/今天/新闻/天气…）→ 触发搜索
 * - 否则不搜索，避免每次对话都发起外部请求
 *
 * 配置（backend/.env）：无需新增任何环境变量
 * 说明：Node 18+ 内置全局 fetch，无需额外 HTTP 依赖。
 */

import { LlmError } from './llm.js'

const BING_SEARCH_URL = 'https://www.bing.com/search'

/** 搜索请求超时（超时即中止，不阻塞聊天） */
const WEB_SEARCH_TIMEOUT_MS = 15_000

/** 伪装浏览器的 UA，降低被 Bing 反爬拦截的概率 */
const BING_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 显式要求联网搜索的意图词（命中即强制搜索） */
const EXPLICIT_WEB_KEYWORDS = [
  '联网',
  '联网搜索',
  '网上查',
  '网上搜',
  '网页搜索',
  '实时搜索',
  '搜索网页',
  '最新资讯',
]

/** 时效性关键词：问题包含这些词时通常需要实时信息 */
const TIME_SENSITIVE_KEYWORDS = [
  '今天',
  '昨天',
  '明天',
  '本周',
  '本月',
  '今年',
  '最新',
  '近日',
  '近期',
  '刚刚',
  '现在',
  '当前',
  '实时',
  '新闻',
  '天气',
  '汇率',
  '股价',
  '股票',
  '行情',
  '油价',
  '金价',
  '热点',
  '政策',
]

export interface WebSearchItem {
  title: string
  content: string
  link: string
  media?: string
  publish_date?: string
}

/** 去掉 HTML 标签并解码常见实体，得到纯文本 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ')
    .replace(/&#0183;|&#8226;/g, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 从结果链接提取站点名（如 https://www.tianqi.com/x → tianqi.com） */
function extractSiteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** 解析 Bing 搜索结果页 HTML，提取 标题/链接/摘要（按链接去重） */
function parseBingResults(html: string, limit: number): WebSearchItem[] {
  const items: WebSearchItem[] = []
  const seen = new Set<string>()

  // 每个 li.b_algo 即一条搜索结果（首次解析后内容紧跟在 b_algo 块内）
  const blocks = html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) ?? []

  for (const block of blocks) {
    if (items.length >= limit) break

    const linkMatch = block.match(/<h2[^>]*><a[^>]*href="([^"]+)"[\s\S]*?<\/a><\/h2>/)
    const titleMatch = block.match(/<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/)
    const summaryMatch = block.match(/<p class="b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/)

    const link = linkMatch?.[1] ?? ''
    const title = titleMatch ? stripHtml(titleMatch[1]) : ''
    if (!link || !title || seen.has(link)) continue
    seen.add(link)

    const summary = summaryMatch ? stripHtml(summaryMatch[1]) : ''
    items.push({
      title,
      link,
      content: summary,
      media: extractSiteName(link) || undefined,
    })
  }

  return items
}

/**
 * 清洗搜索词：去掉口语化的意图词/疑问词，保留核心关键词，
 * 避免 Bing 命中"今天/怎么样"这类无关词（对应商业 API 的意图改写）。
 */
export function cleanSearchQuery(content: string): string {
  return content
    .replace(/^(请|麻烦|帮我|帮忙|给我|你好|嗨)\s*/g, '')
    .replace(
      /(联网|网上查|网上搜|网页搜索|实时搜索|搜索网页|查一下|搜一下|查查|搜搜|搜索|查询|查找)\s*/g,
      '',
    )
    .replace(
      /(怎么样|怎么查|是什么|怎么回事|怎么办|如何|多少|哪里|哪些|什么时候|能推荐|推荐|介绍下|介绍一下)\s*[?？。!！]*$/g,
      '',
    )
    .replace(/[?？。!！，,、\s]+$/g, '')
    .trim()
}

/** 判断某条用户消息是否应触发联网搜索 */
export function decideWebSearch(content: string): boolean {
  const text = content.trim().toLowerCase()
  if (!text) return false
  if (EXPLICIT_WEB_KEYWORDS.some((kw) => text.includes(kw))) return true
  return TIME_SENSITIVE_KEYWORDS.some((kw) => text.includes(kw))
}

/**
 * 执行联网搜索（解析 Bing 免费搜索结果页）
 * @param query 搜索内容（会自动清洗为关键词）
 * @param count 返回条数（默认 6，最大 10）
 * @returns 搜索结果列表；失败时抛出 LlmError
 */
export async function searchWeb(query: string, count = 6): Promise<WebSearchItem[]> {
  const searchQuery = cleanSearchQuery(query)
  const url = `${BING_SEARCH_URL}?q=${encodeURIComponent(searchQuery)}&count=${Math.min(count, 10)}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': BING_USER_AGENT,
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'TimeoutError'
    throw new LlmError(
      aborted ? '联网搜索超时' : `无法连接联网搜索服务: ${(err as Error).message}`,
    )
  }

  if (!response.ok) {
    throw new LlmError(`联网搜索失败（HTTP ${response.status}）`)
  }

  let html: string
  try {
    html = await response.text()
  } catch {
    throw new LlmError('联网搜索返回了无法读取的响应')
  }

  if (html.includes('b_algo') === false) {
    throw new LlmError('联网搜索未返回结果（可能被限流，请稍后再试）')
  }

  return parseBingResults(html, count)
}

/** 将搜索结果组装为注入系统提示的联网资料上下文（带引用编号，便于模型标注来源） */
export function formatWebContext(items: WebSearchItem[]): string {
  const lines = items
    .map(
      (item, i) =>
        `[${i + 1}] 标题：${item.title}\n` +
        `    来源：${item.link}${item.media ? `（${item.media}）` : ''}` +
        `${item.publish_date ? `\n    日期：${item.publish_date}` : ''}\n` +
        `    内容：${item.content.trim()}`,
    )
    .join('\n\n')

  return (
    `[联网搜索资料]\n${lines}\n[资料结束]\n` +
    '请优先基于以上实时搜索资料回答用户问题。回答时在相关表述后用 [1]、[2] 等标注引用编号，' +
    '并在回答末尾附上对应的「参考来源」链接列表。资料不足以回答时，如实告知用户并给出你的通用建议。'
  )
}

/**
 * 为一条用户消息构建联网搜索上下文：
 * - 判定无需搜索、搜索失败或结果为空时返回 null（不阻断聊天）
 * @param question 用户消息内容
 * @returns 可注入系统提示的搜索上下文文本；不需要时返回 null
 */
export async function buildWebSearchContext(question: string): Promise<string | null> {
  if (!decideWebSearch(question)) return null

  let items: WebSearchItem[]
  try {
    items = await searchWeb(question)
  } catch (err) {
    // 搜索失败不应阻断聊天：降级为不注入搜索上下文
    console.warn('[webSearch] 联网搜索失败，跳过:', (err as Error).message)
    return null
  }

  return items.length > 0 ? formatWebContext(items) : null
}
