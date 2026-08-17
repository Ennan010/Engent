/** 临时端到端验证脚本：降级 auth 下验证 SSE 流式端点完整链路 */
const BASE = process.env.TEST_PORT === '3002' ? 'http://localhost:3002' : 'http://localhost:3001'
const TOKEN =
  'eyJhbGciOiJub25lIn0.' +
  Buffer.from(JSON.stringify({ sub: 'diag-user-1' })).toString('base64url') +
  '.sig'

async function main() {
  // 1. 创建会话
  const createRes = await fetch(`${BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ title: 'SSE 诊断' }),
  })
  console.log(`[sse] 创建会话: ${createRes.status}`)
  const conversation = (await createRes.json()) as { id: string }
  if (!conversation?.id) throw new Error(`创建会话失败: ${JSON.stringify(conversation)}`)

  // 2. 流式发送消息
  const started = Date.now()
  const res = await fetch(`${BASE}/api/conversations/${conversation.id}/messages/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ content: '请只回复两个字：收到' }),
    signal: AbortSignal.timeout(60_000),
  })
  console.log(`[sse] 流式端点: ${res.status} | content-type: ${res.headers.get('content-type')}`)
  if (!res.ok || !res.body) {
    console.log(`[sse] 非流式响应: ${(await res.text()).slice(0, 300)}`)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let deltas = 0
  let chars = 0
  let done = false
  let firstDeltaAt = 0
  while (true) {
    const { done: finished, value } = await reader.read()
    if (finished) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const event of events) {
      for (const line of event.split('\n')) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const data = t.slice(5).trim()
        if (!data) continue
        try {
          const parsed = JSON.parse(data) as {
            delta?: string
            done?: boolean
            error?: string
            assistantMessage?: { id?: string }
          }
          if (typeof parsed.delta === 'string' && parsed.delta) {
            if (!firstDeltaAt) firstDeltaAt = Date.now()
            deltas++
            chars += parsed.delta.length
          }
          if (parsed.done && parsed.assistantMessage?.id) {
            done = true
            console.log(`[sse] done 事件 assistantMessage.id: ${parsed.assistantMessage.id}`)
          }
          if (parsed.error) console.log(`[sse] error 事件: ${parsed.error}`)
        } catch {
          // ignore
        }
      }
    }
  }
  console.log(
    `[sse] 首个 delta: ${firstDeltaAt ? `${firstDeltaAt - started}ms` : 'N/A'} | 总耗时: ${Date.now() - started}ms`,
  )
  console.log(`[sse] delta 块数: ${deltas}, 总字符: ${chars}, done: ${done}`)
}

main().catch((err) => {
  console.error('[sse] 失败:', err)
  process.exit(1)
})
