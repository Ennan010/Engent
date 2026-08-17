/**
 * 临时端到端验证脚本：创建会话 → POST /messages/stream → 打印 SSE 事件。
 * 需配合降级模式测试实例（AUTHING_JWKS_URI=占位符）使用。
 */
const BASE = `http://localhost:${process.env.TEST_PORT ?? 3001}`

/** 降级模式下仅需结构合法的 JWT（不验签） */
function makeFakeToken(sub: string): string {
  const enc = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${enc({ alg: 'RS256', kid: 'fake-key', typ: 'JWT' })}.${enc({
    sub,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.c2ln`
}

async function main() {
  const token = makeFakeToken('sse-test-user')

  // 1. 创建会话
  const convRes = await fetch(`${BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  })
  console.log('[create] status:', convRes.status)
  if (!convRes.ok) throw new Error(`创建会话失败: ${await convRes.text()}`)
  const conv = (await convRes.json()) as { id: string }
  console.log('[create] conversationId:', conv.id)

  // 2. 流式发送消息
  const streamRes = await fetch(`${BASE}/api/conversations/${conv.id}/messages/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content: '用一句话介绍你自己' }),
  })
  console.log('[stream] status:', streamRes.status, '| content-type:', streamRes.headers.get('content-type'))
  if (!streamRes.ok || !streamRes.body) throw new Error(`流式请求失败: HTTP ${streamRes.status}`)

  const reader = streamRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let deltaCount = 0
  let totalChars = 0
  let finished = false

  while (!finished) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const event of events) {
      const dataLine = event.split('\n').find((l) => l.trim().startsWith('data:'))
      if (!dataLine) continue
      const data = dataLine.slice(5).trim()
      if (!data) continue
      const parsed = JSON.parse(data) as {
        delta?: string
        done?: boolean
        assistantMessage?: { id: string }
        error?: string
      }
      if (typeof parsed.delta === 'string') {
        deltaCount += 1
        totalChars += parsed.delta.length
        process.stdout.write(parsed.delta)
      }
      if (parsed.done) {
        finished = true
        console.log('\n[DONE] assistantMessage id:', parsed.assistantMessage?.id)
      }
      if (parsed.error) {
        finished = true
        console.log('[ERROR]', parsed.error)
      }
    }
  }

  console.log(`[stream] deltaCount=${deltaCount}, totalChars=${totalChars}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
