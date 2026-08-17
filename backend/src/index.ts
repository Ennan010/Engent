import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import type { NextFunction, Request, Response } from 'express'
import { ensureSqlitePragmas, sequelize } from '../config/database.js'
import './models/index.js'
import routes from './routes/index.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(cors())
app.use(express.json())

// 健康检查（无需登录，供探活与开发调试）
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await sequelize.authenticate()
    res.json({ status: 'ok', db: 'up', time: new Date().toISOString() })
  } catch {
    res.status(500).json({ status: 'error', db: 'down' })
  }
})

app.use('/api', routes)

// 统一错误处理
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Authing JWT 校验失败：token 缺失 / 已过期 / 签名不合法 → 前端应跳转登录页
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: '未授权或 token 已失效' })
  }
  // jwks-rsa 拉取 Authing 公钥失败（域名不通 / 网络异常 / 无匹配密钥）：
  // 这类错误不被 express-jwt 包装，若不处理会以 500/502 形式暴露，误导排查。
  // 统一按登录态校验失败返回 401，并记录详细原因到后端日志。
  const jwksErr = err as { isEndpointUnavailable?: boolean; code?: string }
  const isNetworkCode =
    typeof jwksErr.code === 'string' &&
    /^(EAI_AGAIN|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ERR_)/.test(jwksErr.code)
  if (jwksErr.isEndpointUnavailable || err.name === 'JwksError' || err.name === 'SigningKeyNotFoundError' || isNetworkCode) {
    console.error('[auth] 登录态校验失败（无法获取 Authing JWKS 公钥）:', err.message)
    return res.status(401).json({ error: '未授权或 token 已失效' })
  }
  // body-parser 等已携带状态码的错误（如 JSON 解析失败 400），按其状态码返回
  const status =
    (err as { status?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return res.status(status).json({ error: '请求格式错误' })
  }
  console.error('[error]', err)
  res.status(500).json({ error: '服务器内部错误' })
})

async function bootstrap() {
  try {
    // SQLite：先设置 WAL/busy_timeout 等连接级 PRAGMA，再同步表结构
    await ensureSqlitePragmas()
    await sequelize.sync()
    console.log('[db] 数据库连接成功，数据表已同步')
    app.listen(PORT, () => {
      console.log(`[server] Engent 后端已启动: http://localhost:${PORT}`)
      console.log(`[server] 健康检查: http://localhost:${PORT}/health`)
    })
  } catch (err) {
    console.error('[db] 数据库初始化失败:', err)
    process.exit(1)
  }
}

void bootstrap()
