import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { fetchAuthingUser } from '../middleware/auth.js'

/**
 * Authing OIDC 后端代理路由。
 *
 * 为什么需要代理：本站通过 IP + http 访问，浏览器直连 Authing 域名时
 * 存在跨域 Cookie（SameSite）与部分网络不通的问题，导致前端 Guard
 * 的 checkLoginStatus / trackSession 永远判定未登录（死循环跳转）。
 * 改为由后端服务器（已验证到 Authing 延迟 <0.2s）完成：
 * 1. POST /oidc/callback —— 用授权码换 token
 * 2. GET /me —— 用 Bearer token 换取用户信息（同时校验 token 有效性）
 */
const router = Router()

const authingHost = (process.env.AUTHING_HOST ?? '').trim() || 'https://engent.authing.cn'
const appId = (process.env.AUTHING_APP_ID ?? '').trim()
const redirectUri = (process.env.AUTHING_REDIRECT_URI ?? '').trim()
const tokenEndpoint = `${authingHost}/oidc/token`

/** 用授权码换 token（authorization_code + PKCE code_verifier） */
router.post('/oidc/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, code_verifier } = (req.body ?? {}) as {
      code?: unknown
      code_verifier?: unknown
    }
    if (typeof code !== 'string' || !code) {
      return res.status(400).json({ error: '缺少授权码 code' })
    }
    const params = new URLSearchParams()
    params.set('grant_type', 'authorization_code')
    params.set('client_id', appId)
    params.set('code', code)
    params.set('redirect_uri', redirectUri)
    if (typeof code_verifier === 'string' && code_verifier) {
      params.set('code_verifier', code_verifier)
    }
    const resp = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = (await resp.json()) as {
      access_token?: string
      id_token?: string
      expires_in?: number
    }
    if (!resp.ok || typeof data.access_token !== 'string') {
      console.error('[auth] Authing 换 token 失败:', resp.status, JSON.stringify(data))
      return res.status(400).json({ error: '授权码无效或已过期，请重新登录' })
    }
    res.json({
      access_token: data.access_token,
      id_token: data.id_token ?? null,
      expires_in: data.expires_in ?? null,
    })
  } catch (err) {
    next(err)
  }
})

/** 规范化用户信息：从 Authing userinfo 中提取前端展示所需字段（值统一为 null，避免 undefined） */
function normalizeUser(user: Record<string, unknown>) {
  return {
    sub: user.sub ?? null,
    name: user.name ?? null,
    nickname: user.nickname ?? null,
    username: user.username ?? null,
    preferred_username: user.preferred_username ?? null,
    email: user.email ?? null,
    phone_number: user.phone_number ?? null,
    picture: user.picture ?? null,
    avatar: user.avatar ?? null,
  }
}

/** 获取当前登录用户信息（Bearer token → Authing userinfo），token 无效时返回 401 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
    if (!token) {
      return res.status(401).json({ error: '未授权' })
    }
    const user = await fetchAuthingUser(token)
    res.json(normalizeUser(user))
  } catch (err) {
    next(err)
  }
})

export default router
