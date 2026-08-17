/** 临时诊断脚本：直接测试智谱 GLM 流式 API 的连通性与响应速度 */
import 'dotenv/config'

const API_KEY = process.env.GLM_47_Flash_API_KEY ?? ''
const URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

async function main() {
  console.log(`[diag] apiKey 前6位: ${API_KEY.slice(0, 6)}`)
  console.log(`[diag] 开始请求 ${URL}`)
  const started = Date.now()
  const response = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GLM_TEXT_MODEL ?? 'glm-4.7-flash',
      messages: [{ role: 'user', content: '你好，请回复"收到"两个字' }],
      stream: true,
      temperature: 0.7,
    }),
  })
  console.log(`[diag] 首响应耗时: ${Date.now() - started}ms, status: ${response.status}`)
  if (!response.ok || !response.body) {
    const text = await response.text()
    console.log(`[diag] 非流式响应: ${text.slice(0, 500)}`)
    return
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let chunks = 0
  let chars = 0
  let firstDataAt = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!firstDataAt) firstDataAt = Date.now()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
        const delta = json.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta) {
          chunks++
          chars += delta.length
        }
      } catch {
        // ignore
      }
    }
  }
  console.log(`[diag] 总耗时: ${Date.now() - started}ms, 首个数据块: ${firstDataAt ? `${firstDataAt - started}ms` : 'N/A'}`)
  console.log(`[diag] 增量块: ${chunks}, 总字符: ${chars}`)
}

main().catch((err) => {
  console.error('[diag] 失败:', err)
  process.exit(1)
})
