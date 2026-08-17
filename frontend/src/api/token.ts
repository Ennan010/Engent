/**
 * Authing Guard 登录成功后会将 access_token 缓存到 localStorage 的 accessToken 键
 * （见 @authing/guard-shim-react18 的 setTokenCache 实现）
 */
const ACCESS_TOKEN_KEY = 'accessToken'

export function getToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function clearToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}
