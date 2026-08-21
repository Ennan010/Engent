import { UnauthorizedError } from 'express-jwt'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { User } from '../models/index.js'

const authingHost = (process.env.AUTHING_HOST ?? '').trim() || 'https://engent.authing.cn'
const userinfoEndpoint = `${authingHost}/oidc/me`

/**
 * 认证策略说明：
 * 本站通过 IP + http 访问，浏览器直连 Authing 域名存在跨域 Cookie（SameSite）
 * 问题，且 access_token 可能是 opaque 格式（无法本地 RS256 验签）。
 * 因此统一改为「后端代理 Authing userinfo 端点」验证 Bearer token：
 * - 服务器直连 Authing（已验证延迟 <0.2s），不依赖浏览器 Cookie/跨域
 * - 无论 token 是 JWT 还是 opaque 均可验证
 * - 带 60s 内存缓存，避免每个业务请求都打 Authing
 */

/** userinfo 缓存：token → { user, expiresAt }，仅缓存有效结果 */
const userCache = new Map<string, { user: Record<string, unknown>; expiresAt: number }>()
const USER_CACHE_TTL_MS = 60_000
const USER_CACHE_MAX = 500

/** 通过 Authing userinfo 端点验证并获取用户信息（token 无效时抛 UnauthorizedError） */
export async function fetchAuthingUser(token: string): Promise<Record<string, unknown>> {
  const now = Date.now()
  const cached = userCache.get(token)
  if (cached && cached.expiresAt > now) {
    return cached.user
  }
  const resp = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
    throw new UnauthorizedError('invalid_token', { message: 'token 无效或已过期' })
  }
  if (!resp.ok) {
    throw new Error(`Authing userinfo 请求失败: HTTP ${resp.status}`)
  }
  const user = (await resp.json()) as Record<string, unknown>
  // 只缓存有效响应，防止失效 token 被缓存
  if (user && typeof user === 'object' && 'sub' in user) {
    userCache.set(token, { user, expiresAt: now + USER_CACHE_TTL_MS })
    if (userCache.size > USER_CACHE_MAX) userCache.clear()
  }
  return user
}

/** 从 token 载荷中安全提取可空字符串字段（长度按字段上限截断） */
function stringClaim(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null
}

/** 首次访问时在本地 users 表创建对应用户记录（conversations.user_id 外键依赖 users.id） */
async function syncUser(req: Request, _res: Response, next: NextFunction) {
  const sub = req.auth?.sub
  if (!sub) {
    return next(new UnauthorizedError('credentials_required', { message: '认证信息缺失' }))
  }
  try {
    await User.findOrCreate({
      where: { id: sub },
      defaults: {
        nickname: stringClaim(req.auth?.nickname ?? req.auth?.name, 128),
        avatarUrl: stringClaim(req.auth?.picture ?? req.auth?.avatar, 512),
      },
    })
    req.userId = sub
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * 认证中间件：代理 Authing userinfo 验证 Authorization: Bearer <token>
 * 通过后将用户信息写入 req.auth、userId（Authing sub）写入 req.userId，
 * 并确保本地用户记录存在。
 */
export const requireAuth: RequestHandler[] = [
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
      if (!token) {
        return next(new UnauthorizedError('credentials_required', { message: '缺少认证 token' }))
      }
      const user = await fetchAuthingUser(token)
      req.auth = user
      next()
    } catch (err) {
      next(err)
    }
  },
  syncUser,
]
