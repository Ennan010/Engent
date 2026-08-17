import { expressjwt, UnauthorizedError } from 'express-jwt'
import jwksRsa from 'jwks-rsa'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { User } from '../models/index.js'

const jwksUri = (process.env.AUTHING_JWKS_URI ?? '').trim()

/**
 * 是否已配置真实 Authing JWKS 地址：
 * - 配置后走标准 RS256 签名校验（生产推荐）
 * - 未配置或仍为占位符（YOUR_DOMAIN）时，进入开发降级模式：
 *   仅解析 token 中的 sub 提取用户 ID，不校验签名，保证本地开发全流程可用
 */
const isJwksConfigured = Boolean(jwksUri) && !jwksUri.includes('YOUR_DOMAIN')

if (!isJwksConfigured) {
  console.warn(
    '[auth] AUTHING_JWKS_URI 未配置或仍为占位符，启用开发降级模式（仅解析 token 不验签）。' +
      '生产环境请在 backend/.env 中配置真实的 Authing JWKS 地址。',
  )
}

/** 从 token 载荷中安全提取可空字符串字段（长度按字段上限截断） */
function stringClaim(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null
}

/** 解码 JWT payload（不校验签名），失败返回 null */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(parts[1] as string, 'base64url').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
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
 * Authing JWT 验证中间件：
 * - 标准模式：express-jwt 通过 Authing 的 JWKS 公钥校验 Authorization: Bearer <token>（RS256）
 * - 开发降级模式：AUTHING_JWKS_URI 未配置/占位符时，仅解析 token 提取 sub，不校验签名
 * 两种模式都会将 token 中的 sub（Authing userId）写入 req.userId，并确保本地用户记录存在
 */
export const requireAuth: RequestHandler[] = isJwksConfigured
  ? [
      expressjwt({
        secret: jwksRsa.expressJwtSecret({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
          jwksUri,
        }),
        algorithms: ['RS256'],
        requestProperty: 'auth',
      }),
      syncUser,
    ]
  : [
      (req: Request, _res: Response, next: NextFunction) => {
        const header = req.headers.authorization
        const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
        if (!token) {
          return next(new UnauthorizedError('credentials_required', { message: '缺少认证 token' }))
        }
        const payload = decodeJwtPayload(token)
        if (!payload || typeof payload.sub !== 'string') {
          return next(new UnauthorizedError('invalid_token', { message: 'token 无效' }))
        }
        req.auth = payload
        next()
      },
      syncUser,
    ]
