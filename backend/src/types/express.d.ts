declare global {
  namespace Express {
    interface Request {
      /** 当前登录用户 ID（Authing sub），由 auth 中间件写入 */
      userId?: string
      /** express-jwt 解码后的 token 载荷 */
      auth?: { sub?: string } & Record<string, unknown>
    }
  }
}

export {}
