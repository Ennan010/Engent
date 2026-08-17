/**
 * 文本分块服务：将长文本按语义边界切分为可向量化的块。
 *
 * 策略：优先按段落（空行）切分，段落过长时再按句子/窗口切分，
 * 相邻块之间保留重叠以保证检索时上下文连贯。
 */

const DEFAULT_CHUNK_SIZE = 500
const DEFAULT_OVERLAP = 50

/** 按空行切分为段落 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** 在不超过 maxLen 的前提下，从 candidate 中尽量取完整段落 */
function takeParagraphs(paragraphs: string[], maxLen: number): string[] {
  const taken: string[] = []
  let total = 0
  for (const p of paragraphs) {
    if (total + p.length <= maxLen) {
      taken.push(p)
      total += p.length
    } else {
      break
    }
  }
  return taken
}

/**
 * 将长段落按句子边界切分为 chunk（每块不超过 maxLen，按 Unicode 码点计数）
 *
 * 注意 1：当句子本身超过 maxLen 时（如代码、日志、超长 URL 等无标点片段），
 * 不能直接把整句塞进 current —— 否则会累积出远超 maxLen 的巨型 chunk，
 * 进而超过 embedding 模型的 token 上限（如 bge-m3 8192），导致向量化请求 400。
 * 此时按固定窗口切分，相邻窗口保留 overlap 重叠。
 *
 * 注意 2：切分必须按 Unicode 码点进行，避免把 emoji 等代理对字符从中间切开
 * （产生孤立代理 lone surrogate），否则硅基流动会拒绝请求（400/20015）。
 */
function splitLongParagraph(text: string, maxLen: number, overlap: number): string[] {
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]?/g) ?? [text]
  const chunks: string[] = []
  // 用码点数组累积，保证切分边界始终落在完整码点上
  let current: string[] = []

  const flush = () => {
    const s = current.join('').trim()
    if (s) chunks.push(s)
  }

  for (const sentence of sentences) {
    const sentenceChars = Array.from(sentence)
    if (current.length + sentenceChars.length <= maxLen) {
      current.push(...sentenceChars)
      continue
    }

    // 保留已累积内容尾部 overlap 个码点，作为下一块的上下文前缀
    const tail = current.slice(-overlap)
    flush()

    if (sentenceChars.length > maxLen) {
      // 句子本身超长：按固定窗口切分（码点安全），避免巨型 chunk
      let rest = sentenceChars
      while (rest.length > maxLen) {
        chunks.push(rest.slice(0, maxLen).join('').trim())
        rest = rest.slice(maxLen - overlap)
      }
      current = rest
    } else {
      current = tail.concat(sentenceChars)
    }
  }

  if (current.length > 0) flush()
  return chunks
}

/**
 * 将文本切分为若干块
 * @param text 原始文本
 * @param size 每块目标字符数（默认 500）
 * @param overlap 相邻块重叠字符数（默认 50）
 * @returns 文本块数组（非空）
 */
export function chunkText(
  text: string,
  size: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP,
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  // 短文本整块返回
  if (normalized.length <= size) return [normalized]

  const paragraphs = splitParagraphs(normalized)
  const chunks: string[] = []
  let i = 0

  while (i < paragraphs.length) {
    const taken = takeParagraphs(paragraphs.slice(i), size)
    if (taken.length > 0) {
      const block = taken.join(' ')
      if (block.length > size) {
        chunks.push(...splitLongParagraph(block, size, overlap))
      } else {
        chunks.push(block)
      }
      i += taken.length
    } else {
      // 单个段落本身超过上限：按句子切分
      chunks.push(...splitLongParagraph(paragraphs[i], size, overlap))
      i += 1
    }
  }

  return chunks.filter((c) => c.length > 0)
}
