/**
 * 临时 HTTP 测试：验证 auth 降级模式 + 完整发送消息链路（真实调用 GLM）
 */
const BASE = `http://localhost:${process.env.TEST_PORT ?? 3001}`
const TOKEN =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2Uta2V5IiwidHlwIjoiSldUIn0.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjE3ODY5NDAyMTF9.c2ln'

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`[${method} ${path}] status=${res.status} body=${text.slice(0, 600)}`)
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function main() {
  // 1. 创建会话
  const created = await call('/api/conversations', 'POST', {})
  const conversationId = created.data?.id
  if (!conversationId) {
    console.error('创建会话失败，退出')
    return
  }
  // 2. 发送消息（真实 GLM）
  await call(`/api/conversations/${conversationId}/messages`, 'POST', {
    content: '你好，请用一句话介绍你自己',
  })
  // 3. 拉取消息列表
  await call(`/api/conversations/${conversationId}/messages`, 'GET')
  // 4. 清理测试会话
  await call(`/api/conversations/${conversationId}`, 'DELETE')
}

main().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
